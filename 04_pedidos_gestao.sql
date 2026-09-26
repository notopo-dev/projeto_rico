-- =====================================================================
-- Gestão de pedidos — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- Idempotente: pode rodar quantas vezes quiser, sem duplicar nada.
--
-- O que ele adiciona:
--   1. o status "devolvido" no fluxo do pedido
--   2. os campos de reembolso (quanto, quando, por quê, id na Stripe)
--   3. observações internas do lojista (não aparecem para o cliente)
--   4. os índices que essas telas usam
--   5. o RLS dessas colunas novas (herdado das políticas de orders)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Status "devolvido"
--
-- O check antigo só aceitava até "cancelado". Um pedido reembolsado
-- não é a mesma coisa que um cancelado: o cancelado nunca foi pago,
-- o devolvido foi pago e o dinheiro voltou. Separar os dois é o que
-- mantém o relatório de faturamento honesto.
-- ---------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'pendente', 'pago', 'enviado', 'entregue', 'cancelado', 'devolvido'
  ));

-- ---------------------------------------------------------------------
-- 2. Reembolso
--
-- valor_reembolsado guarda o ACUMULADO. Reembolsos parciais somam
-- aqui, e é esse número que impede devolver mais do que foi pago:
-- a Edge Function calcula (total - valor_reembolsado) antes de
-- chamar a Stripe.
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists valor_reembolsado numeric(10,2) not null default 0,
  add column if not exists reembolsado_em timestamptz,
  add column if not exists motivo_reembolso text,
  add column if not exists stripe_refund_id text,
  add column if not exists observacoes_internas text;

comment on column public.orders.valor_reembolsado is
  'Total já devolvido ao cliente (soma dos reembolsos parciais)';
comment on column public.orders.observacoes_internas is
  'Anotações do lojista — nunca exibidas na loja pública';

-- Não deixa o acumulado passar do total do pedido nem ficar negativo.
-- Esta trava é do BANCO: mesmo que alguém chame a API por fora, não passa.
alter table public.orders drop constraint if exists orders_reembolso_valido;
alter table public.orders add constraint orders_reembolso_valido
  check (valor_reembolsado >= 0 and valor_reembolsado <= total);

-- ---------------------------------------------------------------------
-- 3. Índices das consultas da tela de pedidos
-- ---------------------------------------------------------------------
create index if not exists idx_orders_store_criado
  on public.orders (store_id, created_at desc);

create index if not exists idx_orders_me_order
  on public.orders (melhor_envio_order_id)
  where melhor_envio_order_id is not null;

-- ---------------------------------------------------------------------
-- 4. RLS
--
-- As colunas novas entram nas tabelas que JÁ têm política (03_rls_relatorios.sql):
-- no Postgres a política vale para a linha inteira, então nada a criar aqui.
-- O bloco abaixo só GARANTE que as políticas existem, caso o 03 não
-- tenha sido rodado ainda — sem elas, a tela de pedidos de uma loja
-- enxergaria pedido de outra.
-- ---------------------------------------------------------------------
create or replace function public.minha_loja_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.stores where owner_id = auth.uid() limit 1;
$$;

revoke all on function public.minha_loja_id() from public;
grant execute on function public.minha_loja_id() to authenticated;

alter table public.orders enable row level security;

drop policy if exists "dono_le_pedidos" on public.orders;
create policy "dono_le_pedidos"
  on public.orders for select
  to authenticated
  using (store_id = public.minha_loja_id());

drop policy if exists "dono_altera_pedidos" on public.orders;
create policy "dono_altera_pedidos"
  on public.orders for update
  to authenticated
  using (store_id = public.minha_loja_id())
  with check (store_id = public.minha_loja_id());

-- ---------------------------------------------------------------------
-- 5. Conferência
-- ---------------------------------------------------------------------
select
  column_name,
  data_type,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in (
    'valor_reembolsado', 'reembolsado_em', 'motivo_reembolso',
    'stripe_refund_id', 'observacoes_internas'
  )
order by column_name;

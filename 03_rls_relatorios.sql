-- =====================================================================
-- Isolamento entre lojas (RLS) — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- Idempotente: pode rodar quantas vezes quiser.
--
-- POR QUE ISTO É A PROTEÇÃO DE VERDADE
-- O filtro `.eq("store_id", ...)` que o JavaScript envia é
-- conveniência, não segurança: qualquer pessoa abre o navegador,
-- edita o código da página e pede outro store_id. Quem precisa
-- recusar é o banco.
--
-- Com as políticas abaixo, um pedido dessa natureza volta VAZIO —
-- não é erro, não vaza nada, simplesmente não existe para aquele
-- usuário.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Função auxiliar: a loja do usuário autenticado.
-- STABLE permite ao Postgres calcular uma vez por consulta em vez de
-- uma vez por linha — sem isto o RLS fica lento em tabela grande.
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

-- ---------------------------------------------------------------------
-- ORDERS — o dono vê e altera só os pedidos da própria loja
-- ---------------------------------------------------------------------
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
-- ORDER_ITEMS — seguem o pedido a que pertencem
-- ---------------------------------------------------------------------
alter table public.order_items enable row level security;

drop policy if exists "dono_le_itens" on public.order_items;
create policy "dono_le_itens"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.store_id = public.minha_loja_id()
    )
  );

-- ---------------------------------------------------------------------
-- CUSTOMERS — dados pessoais dos clientes: CPF, telefone, endereço.
-- É a tabela mais sensível do sistema.
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;

drop policy if exists "dono_le_clientes" on public.customers;
create policy "dono_le_clientes"
  on public.customers for select
  to authenticated
  using (store_id = public.minha_loja_id());

drop policy if exists "dono_altera_clientes" on public.customers;
create policy "dono_altera_clientes"
  on public.customers for update
  to authenticated
  using (store_id = public.minha_loja_id())
  with check (store_id = public.minha_loja_id());

-- ---------------------------------------------------------------------
-- PAYMENTS — valores e ids da Stripe
-- ---------------------------------------------------------------------
alter table public.payments enable row level security;

drop policy if exists "dono_le_pagamentos" on public.payments;
create policy "dono_le_pagamentos"
  on public.payments for select
  to authenticated
  using (store_id = public.minha_loja_id());

-- ---------------------------------------------------------------------
-- PRODUCTS — leitura pública (a vitrine precisa), escrita só do dono
-- ---------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "dono_gerencia_produtos" on public.products;
create policy "dono_gerencia_produtos"
  on public.products for all
  to authenticated
  using (store_id = public.minha_loja_id())
  with check (store_id = public.minha_loja_id());

-- ---------------------------------------------------------------------
-- Conferência: toda tabela sensível precisa aparecer com rls = true
-- ---------------------------------------------------------------------
select
  c.relname as tabela,
  c.relrowsecurity as rls_ligado,
  count(p.polname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'orders', 'order_items', 'customers', 'payments',
    'products', 'stores', 'store_settings', 'stripe_events'
  )
group by c.relname, c.relrowsecurity
order by c.relrowsecurity, c.relname;

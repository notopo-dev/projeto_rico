-- ============================================================
-- 51 — CUPOM DE DESCONTO
--
-- Não apaga nada. Pode rodar mais de uma vez.
--
-- ------------------------------------------------------------
-- A regra que decide todo o desenho
-- ------------------------------------------------------------
-- O desconto é calculado AQUI, no banco. O navegador manda só o
-- CÓDIGO digitado — nunca o valor.
--
-- Se o valor viesse da tela, qualquer pessoa abriria o console e
-- mandaria `desconto: 999`. Em loja de roupa isso é mercadoria
-- saindo de graça, e o lojista só descobre no fim do mês.
--
-- ------------------------------------------------------------
-- Por que em duas etapas, e não dentro do criar_pedido_publico
-- ------------------------------------------------------------
-- O `criar_pedido_publico` tem 407 linhas e é o caminho de TODA
-- venda da plataforma. Editar aquilo para encaixar o cupom é risco
-- grande por ganho pequeno.
--
-- Então: o pedido nasce sem desconto, e a `aplicar_cupom` abaixo
-- reescreve o total depois — antes de a cobrança ser criada. A
-- `stripe-create-payment-intent` já confere se o valor cobrado
-- bate com o total do pedido, então a ordem das coisas protege
-- sozinha: aplicar o cupom DEPOIS da cobrança não faria o cliente
-- pagar menos, só deixaria o pedido inconsistente — e a função
-- recusa justamente esse caso.
--
-- ------------------------------------------------------------
-- O visitante não lê a tabela de cupons
-- ------------------------------------------------------------
-- Nenhum grant de SELECT para `anon` em `coupons`. Se tivesse, dava
-- para listar todos os códigos da loja e usar o de maior desconto.
-- Quem valida é a função, que roda como dona (SECURITY DEFINER).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. A tabela
-- ------------------------------------------------------------
create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,

  -- Guardado como o lojista digitou, para ele reconhecer na lista.
  -- A comparação é sempre sem caixa e sem espaço (ver o índice).
  codigo        text not null,

  tipo          text not null check (tipo in ('percentual', 'valor')),
  valor         numeric(12,2) not null check (valor > 0),

  /** Subtotal mínimo para o cupom valer. Nulo = sem mínimo. */
  minimo_compra numeric(12,2) check (minimo_compra is null or minimo_compra >= 0),

  /** Zera o frete junto com o desconto. */
  frete_gratis  boolean not null default false,

  comeca_em     timestamptz,
  expira_em     timestamptz,

  /** Quantas vezes o cupom pode ser usado na loja. Nulo = sem limite. */
  limite_total       integer check (limite_total is null or limite_total > 0),
  /** Quantas vezes o MESMO CPF pode usar. Nulo = sem limite. */
  limite_por_cliente integer check (limite_por_cliente is null or limite_por_cliente > 0),

  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Percentual acima de 100 é erro de digitação, não promoção.
  constraint coupons_percentual_ate_100
    check (tipo <> 'percentual' or valor <= 100),

  -- Validade invertida não é cupom, é engano.
  constraint coupons_validade_coerente
    check (comeca_em is null or expira_em is null or expira_em > comeca_em)
);

-- Um código por loja, ignorando caixa e espaço. Duas lojas podem ter
-- "VERAO10" cada uma — são cupons diferentes, de donos diferentes.
create unique index if not exists coupons_codigo_por_loja
  on public.coupons (store_id, upper(btrim(codigo)));

create index if not exists coupons_store_ativo
  on public.coupons (store_id) where ativo;

-- ------------------------------------------------------------
-- 2. O pedido passa a registrar o cupom
-- ------------------------------------------------------------
-- `desconto` com default 0 e NOT NULL: pedido sem cupom tem
-- desconto zero, não nulo. Nulo em coluna de dinheiro é como
-- `null + 10 = null` chega num relatório e zera a receita do mês.
alter table public.orders
  add column if not exists cupom_id       uuid references public.coupons(id) on delete set null,
  add column if not exists cupom_codigo   text,
  add column if not exists desconto       numeric(12,2) not null default 0,
  -- Frete abatido pelo cupom, guardado SEPARADO do frete.
  --
  -- A primeira versão desta migração zerava `orders.frete` quando o
  -- cupom dava frete grátis. Parecia mais simples e estava errado: o
  -- valor original se perdia, e ao remover o cupom o pedido ficava
  -- com frete zero PARA SEMPRE. Dava para aplicar o cupom, remover,
  -- e levar a entrega de graça.
  --
  -- Agora `frete` é sempre o que a transportadora cobra — o que
  -- também mantém o relatório de frete honesto — e o abatimento
  -- mora aqui.
  add column if not exists desconto_frete numeric(12,2) not null default 0;

alter table public.orders
  drop constraint if exists orders_desconto_nao_negativo;
alter table public.orders
  add constraint orders_desconto_nao_negativo
  check (desconto >= 0 and desconto_frete >= 0);

-- ------------------------------------------------------------
-- 3. Quantas vezes o cupom já foi usado
-- ------------------------------------------------------------
-- Contado dos PEDIDOS, não de um contador na tabela do cupom.
-- Contador separado desencontra do mundo real na primeira vez que
-- um pedido é cancelado — e aí o lojista jura que sobrou uso e o
-- sistema jura que não.
--
-- Pedido cancelado NÃO consome uso: o cliente desistiu, o cupom
-- volta a valer.
create or replace function public.cupom_usos(p_coupon_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
    from public.orders o
   where o.cupom_id = p_coupon_id
     and o.status <> 'cancelado';
$$;

create or replace function public.cupom_usos_do_cliente(
  p_coupon_id uuid,
  p_customer_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
    from public.orders o
   where o.cupom_id = p_coupon_id
     and o.customer_id = p_customer_id
     and o.status <> 'cancelado';
$$;

-- ------------------------------------------------------------
-- 4. Aplicar o cupom no pedido
-- ------------------------------------------------------------
create or replace function public.aplicar_cupom(
  p_order_id uuid,
  p_codigo   text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido  record;
  v_cupom   record;
  v_desconto       numeric(12,2);
  v_desconto_frete numeric(12,2);
  v_frete          numeric(12,2);
  v_total          numeric(12,2);
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    raise exception 'Digite o código do cupom.';
  end if;

  -- FOR UPDATE: dois cliques no botão "aplicar" ao mesmo tempo não
  -- aplicam dois descontos no mesmo pedido.
  select o.id, o.store_id, o.customer_id, o.status,
         o.subtotal, o.frete, o.cupom_id
    into v_pedido
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  -- Só pedido ainda não pago. Depois da cobrança, mexer no total
  -- deixaria o pedido dizendo um valor e a cobrança outro.
  if v_pedido.status <> 'pendente' then
    raise exception 'Este pedido já foi finalizado e não aceita mais cupom.';
  end if;

  if v_pedido.cupom_id is not null then
    raise exception 'Este pedido já tem um cupom aplicado.';
  end if;

  select c.* into v_cupom
    from public.coupons c
   where c.store_id = v_pedido.store_id
     and upper(btrim(c.codigo)) = upper(btrim(p_codigo));

  -- Mensagem igual para "não existe" e "não vale mais": dizer qual
  -- dos dois é entrega para quem está testando códigos no escuro
  -- que ele acertou um que existe.
  if not found or not v_cupom.ativo then
    raise exception 'Cupom inválido.';
  end if;

  if v_cupom.comeca_em is not null and now() < v_cupom.comeca_em then
    raise exception 'Este cupom ainda não começou a valer.';
  end if;

  if v_cupom.expira_em is not null and now() > v_cupom.expira_em then
    raise exception 'Este cupom já expirou.';
  end if;

  if v_cupom.minimo_compra is not null
     and v_pedido.subtotal < v_cupom.minimo_compra then
    -- Vírgula na mão: o separador do to_char depende do lc_numeric
    -- do servidor, e no Supabase ele não é pt-BR. "R$ 200.00" numa
    -- loja brasileira parece erro do sistema.
    raise exception 'Este cupom vale em compras a partir de R$ %.',
      replace(to_char(v_cupom.minimo_compra, 'FM9999990.00'), '.', ',');
  end if;

  if v_cupom.limite_total is not null
     and public.cupom_usos(v_cupom.id) >= v_cupom.limite_total then
    raise exception 'Este cupom já atingiu o limite de usos.';
  end if;

  if v_cupom.limite_por_cliente is not null
     and v_pedido.customer_id is not null
     and public.cupom_usos_do_cliente(v_cupom.id, v_pedido.customer_id)
         >= v_cupom.limite_por_cliente then
    raise exception 'Você já usou este cupom.';
  end if;

  -- ---- a conta ----
  if v_cupom.tipo = 'percentual' then
    v_desconto := round(v_pedido.subtotal * v_cupom.valor / 100, 2);
  else
    -- Desconto maior que a compra não vira troco: para no subtotal.
    v_desconto := least(v_cupom.valor, v_pedido.subtotal);
  end if;

  v_frete := coalesce(v_pedido.frete, 0);
  v_desconto_frete := case when v_cupom.frete_gratis then v_frete else 0 end;
  v_total := v_pedido.subtotal + v_frete - v_desconto - v_desconto_frete;

  -- Cinto de segurança: total negativo não existe.
  if v_total < 0 then
    v_total := 0;
  end if;

  -- `frete` NÃO entra no update de propósito — ver o comentário da
  -- coluna desconto_frete.
  update public.orders
     set cupom_id       = v_cupom.id,
         cupom_codigo   = btrim(v_cupom.codigo),
         desconto       = v_desconto,
         desconto_frete = v_desconto_frete,
         total          = v_total,
         updated_at     = now()
   where id = p_order_id;

  return jsonb_build_object(
    'codigo',         btrim(v_cupom.codigo),
    'desconto',       v_desconto,
    'desconto_frete', v_desconto_frete,
    'frete',          v_frete,
    'total',          v_total,
    'frete_gratis',   v_cupom.frete_gratis
  );
end $$;

-- ------------------------------------------------------------
-- 5. Tirar o cupom do pedido
-- ------------------------------------------------------------
-- Existe para o cliente que digitou um e quer trocar por outro.
-- O frete volta inteiro porque ele nunca foi alterado: o abatimento
-- estava em `desconto_frete`, e é esse que zeramos.
create or replace function public.remover_cupom(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido record;
begin
  select o.id, o.status, o.subtotal, o.frete
    into v_pedido
    from public.orders o
   where o.id = p_order_id
     for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_pedido.status <> 'pendente' then
    raise exception 'Este pedido já foi finalizado.';
  end if;

  update public.orders
     set cupom_id       = null,
         cupom_codigo   = null,
         desconto       = 0,
         desconto_frete = 0,
         total          = v_pedido.subtotal + coalesce(v_pedido.frete, 0),
         updated_at     = now()
   where id = p_order_id;

  return jsonb_build_object(
    'desconto', 0,
    'total',    v_pedido.subtotal + coalesce(v_pedido.frete, 0)
  );
end $$;

-- ------------------------------------------------------------
-- 6. Permissões
-- ------------------------------------------------------------
alter table public.coupons enable row level security;

-- O lojista manda nos cupons da própria loja. Mesma forma da
-- política que já existe em stores.
drop policy if exists cupons_do_dono on public.coupons;
create policy cupons_do_dono on public.coupons
  for all to authenticated
  using (
    store_id in (select s.id from public.stores s where s.owner_id = auth.uid())
  )
  with check (
    store_id in (select s.id from public.stores s where s.owner_id = auth.uid())
  );

revoke all on public.coupons from anon, authenticated, public;
grant select, insert, update, delete on public.coupons to authenticated;

-- ⚠️ `anon` NÃO ganha nada em `coupons`. Ele chama a função.
revoke all on function public.aplicar_cupom(uuid, text) from public;
revoke all on function public.remover_cupom(uuid) from public;
revoke all on function public.cupom_usos(uuid) from public;
revoke all on function public.cupom_usos_do_cliente(uuid, uuid) from public;

grant execute on function public.aplicar_cupom(uuid, text) to anon, authenticated;
grant execute on function public.remover_cupom(uuid) to anon, authenticated;
grant execute on function public.cupom_usos(uuid) to authenticated;
grant execute on function public.cupom_usos_do_cliente(uuid, uuid) to authenticated;

commit;

-- ============================================================
-- Conferência
-- ============================================================
select 'tabela de cupons criada' as verificacao,
       case when exists (
         select 1 from information_schema.tables
          where table_schema='public' and table_name='coupons'
       ) then 'SIM' else 'NÃO' end as resultado
union all
select 'pedido registra desconto',
  case when (
    select count(*) from information_schema.columns
     where table_schema='public' and table_name='orders'
       and column_name in ('cupom_id','cupom_codigo','desconto','desconto_frete')
  ) = 4 then 'SIM' else 'NÃO' end
union all
select 'visitante consegue LER a tabela de cupons',
  case when exists (
    select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='coupons' and grantee='anon'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select 'visitante consegue aplicar cupom (função)',
  case when exists (
    select 1 from information_schema.routine_privileges
     where routine_schema='public' and routine_name='aplicar_cupom'
       and grantee='anon' and privilege_type='EXECUTE'
  ) then 'sim (correto)' else 'NÃO — o checkout vai falhar' end
union all
select 'RLS ligada em coupons',
  case when (select c.relrowsecurity from pg_class c
              join pg_namespace n on n.oid=c.relnamespace
             where n.nspname='public' and c.relname='coupons')
  then 'SIM' else 'NÃO' end;

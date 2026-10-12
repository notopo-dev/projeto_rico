-- ============================================================
-- 51b — PERMISSÃO DAS COLUNAS NOVAS + CONTAGEM EM UMA CHAMADA
--
-- Não apaga nada. Pode rodar mais de uma vez.
--
-- ------------------------------------------------------------
-- Por que esta migração existe
-- ------------------------------------------------------------
-- Duas coisas que a 51 deixou passar.
--
-- 1. No Postgres, COLUNA NOVA NÃO HERDA a permissão da tabela.
--    Foi exatamente isso que derrubou toda loja pública em 01/10
--    (ver 32_permissao_colunas_loja.sql): a consulta INTEIRA é
--    recusada com 42501 quando uma das colunas pedidas é proibida.
--    A 51 criou `cupom_id`, `cupom_codigo`, `desconto` e
--    `desconto_frete` em `orders` sem conceder nada.
--
-- 2. A tela de cupons contava os usos com uma chamada POR CUPOM.
--    Vinte cupons, vinte idas ao servidor. A função abaixo devolve
--    tudo de uma vez.
--
-- O `grant` é inofensivo se a tabela já der permissão no nível dela:
-- conceder de novo não muda nada. Se ela der por coluna, é o que
-- evita o apagão.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. O lojista lê as colunas novas dos próprios pedidos
-- ------------------------------------------------------------
grant select (cupom_id, cupom_codigo, desconto, desconto_frete)
  on public.orders to authenticated;

-- O visitante NÃO entra aqui de propósito: ele não lê `orders`
-- direto (a migração 46 fechou isso), e a consulta pública de
-- pedido passa por função própria.

-- ------------------------------------------------------------
-- 2. Usos de todos os cupons da loja, numa chamada
-- ------------------------------------------------------------
-- SECURITY DEFINER para poder contar em `orders`, com a checagem de
-- dono feita aqui dentro: sem ela, um lojista passaria o id da loja
-- de outro e leria o movimento dele.
create or replace function public.cupom_usos_da_loja(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(c.id::text, u.n), '{}'::jsonb)
    from public.coupons c
    left join lateral (
      select count(*)::integer as n
        from public.orders o
       where o.cupom_id = c.id
         and o.status <> 'cancelado'
    ) u on true
   where c.store_id = p_store_id
     and exists (
       select 1 from public.stores s
        where s.id = p_store_id
          and s.owner_id = auth.uid()
     );
$$;

revoke all on function public.cupom_usos_da_loja(uuid) from public;
grant execute on function public.cupom_usos_da_loja(uuid) to authenticated;

commit;

-- ============================================================
-- Conferência
-- ============================================================
select 'lojista lê as 4 colunas novas de orders' as verificacao,
  case when (
    select count(*) from information_schema.column_privileges
     where table_schema='public' and table_name='orders'
       and column_name in ('cupom_id','cupom_codigo','desconto','desconto_frete')
       and grantee='authenticated' and privilege_type='SELECT'
  ) = 4 then 'sim (correto)' else 'NÃO — a tela vai quebrar' end as resultado
union all
select 'visitante lê o cupom do pedido',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema='public' and table_name='orders'
       and column_name = 'cupom_id'
       and grantee='anon' and privilege_type='SELECT'
  ) then 'sim — conferir se é proposital' else 'não (correto)' end
union all
select 'contagem de usos em uma chamada',
  case when exists (
    select 1 from information_schema.routine_privileges
     where routine_schema='public' and routine_name='cupom_usos_da_loja'
       and grantee='authenticated' and privilege_type='EXECUTE'
  ) then 'sim (correto)' else 'NÃO' end;

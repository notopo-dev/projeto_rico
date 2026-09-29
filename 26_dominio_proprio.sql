-- ==================================================================
-- 26_dominio_proprio.sql
--
-- Domínio próprio por loja.
--
-- Só ADIÇÃO: nenhuma coluna existente é alterada, nenhuma tabela é
-- apagada, nenhum dado é tocado. Rodar este arquivo duas vezes não
-- causa erro (tudo é "if not exists" / "or replace").
--
-- O QUE ESTE ARQUIVO NÃO FAZ: ele não configura nada na Vercel nem
-- na Stripe. Ele só guarda qual é o domínio e em que pé está. Quem
-- aponta o DNS e registra o domínio nos dois lugares é uma pessoa,
-- fora daqui.
-- ==================================================================

-- ---- 1. Colunas -------------------------------------------------
alter table public.stores
  add column if not exists dominio text,
  add column if not exists dominio_status text not null default 'nenhum',
  add column if not exists dominio_em timestamptz;

comment on column public.stores.dominio is
  'Domínio próprio da loja, só o host, sem https:// e sem barra. Ex: lojadofulano.com.br';

comment on column public.stores.dominio_status is
  'nenhum | pendente | ativo. "pendente" = cadastrado aqui, mas o DNS ou o certificado ainda não estão prontos.';

-- Um domínio não pode pertencer a duas lojas: é o que resolve o
-- host para uma loja só. Índice único parcial, porque a maioria das
-- lojas tem dominio nulo e nulo não conflita com nulo.
create unique index if not exists stores_dominio_unico
  on public.stores (lower(dominio))
  where dominio is not null;

-- Só três valores. Sem isto, um erro de digitação em "ativo" faria
-- a loja nunca resolver, e o sintoma apareceria como "loja não
-- encontrada" — difícil de ligar à causa.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_dominio_status_valido'
  ) then
    alter table public.stores
      add constraint stores_dominio_status_valido
      check (dominio_status in ('nenhum', 'pendente', 'ativo'));
  end if;
end $$;

-- ---- 2. Leitura pelo visitante anônimo --------------------------
-- A loja precisa ser encontrada pelo host antes de qualquer login.
-- O grant é por COLUNA: o anônimo passa a ler apenas estas duas a
-- mais, não a tabela inteira.
grant select (dominio, dominio_status) on public.stores to anon;
grant select (dominio, dominio_status) on public.stores to authenticated;

-- ---- 3. Resolver host -> loja -----------------------------------
-- Função em vez de consulta direta do navegador por dois motivos:
-- normaliza o host (minúsculas, tira "www.") num lugar só, e não
-- expõe a lista de domínios — responde sobre UM host por vez.
create or replace function public.loja_por_dominio(p_host text)
returns table (slug text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.slug
  from public.stores s
  where s.ativo = true
    and s.dominio_status = 'ativo'
    and lower(s.dominio) = lower(
      regexp_replace(coalesce(p_host, ''), '^www\.', '')
    )
  limit 1;
$$;

revoke all on function public.loja_por_dominio(text) from public;
grant execute on function public.loja_por_dominio(text) to anon, authenticated;

-- ---- 4. Conferência ---------------------------------------------
select
  'colunas' as item,
  count(*) filter (where column_name in ('dominio','dominio_status','dominio_em')) as encontradas,
  3 as esperadas
from information_schema.columns
where table_schema = 'public' and table_name = 'stores'

union all

select
  'indice unico',
  count(*), 1
from pg_indexes
where schemaname = 'public' and indexname = 'stores_dominio_unico'

union all

select
  'funcao loja_por_dominio',
  count(*), 1
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'loja_por_dominio';

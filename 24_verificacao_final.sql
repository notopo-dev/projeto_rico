-- ============================================================
-- 24_verificacao_final.sql
--
-- SÓ LÊ. Não altera nada.
--
-- Segunda varredura: confere, no banco de verdade, se cada correção
-- da auditoria pegou. Devolve UMA tabela pequena, um veredito por
-- linha. É só copiar o resultado inteiro.
--
-- Leitura: qualquer linha com "FALHA" é porta aberta. "OK" é fechado.
-- ============================================================

with
-- 1. Tabelas sem RLS: estão 100% abertas pela API
sem_rls as (
  select string_agg(c.relname, ', ' order by c.relname) as lista
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
-- 2. Tabelas com RLS mas sem policy nenhuma: ficam inacessíveis
rls_sem_policy as (
  select string_agg(c.relname, ', ' order by c.relname) as lista
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = c.relname)
),
-- 3. Escrita pública sobrando em tabela sensível
escrita_publica as (
  select string_agg(tablename || '.' || policyname, ', ') as lista
    from pg_policies
   where schemaname = 'public'
     and tablename in ('customers','orders','order_items','payments','store_settings','stores','profiles')
     and cmd in ('INSERT','UPDATE','DELETE','ALL')
     and 'public' = any(roles)
     and coalesce(qual,'') || coalesce(with_check,'') not like '%auth.uid()%'
),
-- 4. Leitura pública de clientes
leitura_clientes as (
  select string_agg(policyname, ', ') as lista
    from pg_policies
   where schemaname='public' and tablename='customers' and cmd in ('SELECT','ALL')
     and 'public' = any(roles)
     and coalesce(qual,'') not like '%auth.uid()%'
),
-- 5. Views que ignoram RLS
views_furando as (
  select string_agg(c.relname, ', ') as lista
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relkind='v'
     and coalesce((select option_value from pg_options_to_table(c.reloptions)
                    where option_name='security_invoker'),'off') <> 'true'
),
-- 6. Colunas sensíveis de stores que o anônimo ainda lê
colunas_stores as (
  select string_agg(column_name, ', ' order by column_name) as lista
    from information_schema.column_privileges
   where table_schema='public' and table_name='stores' and grantee='anon'
     and privilege_type='SELECT'
     and (column_name like 'stripe%' or column_name like 'assinatura%'
          or column_name in ('owner_id','plano','plano_renovacao','cep_origem',
                             'endereco_logradouro','endereco_numero'))
),
-- 7. Funções security definer sem search_path fixo
funcoes_soltas as (
  select string_agg(p.proname, ', ') as lista
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.prosecdef
     and (p.proconfig is null
          or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
),
-- 8. Storage: escrita sem verificação de pasta
storage_solto as (
  select string_agg(policyname, ', ') as lista
    from pg_policies
   where schemaname='storage' and tablename='objects'
     and cmd in ('INSERT','UPDATE','DELETE','ALL')
     and coalesce(qual,'') || coalesce(with_check,'') not like '%owner_id = auth.uid()%'
),
-- 9. Peças que deveriam existir
pecas as (
  select
    to_regprocedure('public.criar_pedido_publico(uuid,jsonb,jsonb,text,jsonb,jsonb)') is not null as tem_pedido,
    to_regprocedure('public.consumir_limite(text,integer,integer)') is not null as tem_limite,
    to_regclass('public.rate_limit') is not null as tem_tabela_limite,
    to_regprocedure('public.melhor_envio_conectado()') is not null as tem_me
)
select * from (
  select 1 as n, 'Tabelas SEM RLS (abertas pela API)' as verificacao,
         case when (select lista from sem_rls) is null then 'OK' else 'FALHA' end as situacao,
         coalesce((select lista from sem_rls), 'nenhuma') as detalhe
  union all
  select 2, 'Tabelas com RLS e nenhuma policy (inacessíveis)',
         case when (select lista from rls_sem_policy) is null then 'OK' else 'ATENCAO' end,
         coalesce((select lista from rls_sem_policy), 'nenhuma')
  union all
  select 3, 'Escrita publica em tabela sensivel',
         case when (select lista from escrita_publica) is null then 'OK' else 'FALHA' end,
         coalesce((select lista from escrita_publica), 'nenhuma')
  union all
  select 4, 'Leitura publica da tabela de clientes',
         case when (select lista from leitura_clientes) is null then 'OK' else 'FALHA' end,
         coalesce((select lista from leitura_clientes), 'nenhuma')
  union all
  select 5, 'Views ignorando RLS',
         case when (select lista from views_furando) is null then 'OK' else 'FALHA' end,
         coalesce((select lista from views_furando), 'nenhuma')
  union all
  select 6, 'Colunas sensiveis de stores visiveis ao anonimo',
         case when (select lista from colunas_stores) is null then 'OK' else 'FALHA' end,
         coalesce((select lista from colunas_stores), 'nenhuma')
  union all
  select 7, 'Funcoes security definer sem search_path',
         case when (select lista from funcoes_soltas) is null then 'OK' else 'ATENCAO' end,
         coalesce((select lista from funcoes_soltas), 'nenhuma')
  union all
  select 8, 'Storage: escrita sem verificar a pasta da loja',
         case when (select lista from storage_solto) is null then 'OK' else 'FALHA' end,
         coalesce((select lista from storage_solto), 'nenhuma')
  union all
  select 9, 'Funcao criar_pedido_publico existe',
         case when (select tem_pedido from pecas) then 'OK' else 'FALHA' end, ''
  union all
  select 10, 'Rate limit instalado (tabela + funcao)',
         case when (select tem_limite and tem_tabela_limite from pecas) then 'OK' else 'FALHA' end, ''
  union all
  select 11, 'Funcao melhor_envio_conectado existe',
         case when (select tem_me from pecas) then 'OK' else 'FALHA' end, ''
  union all
  select 12, 'Trava de estoque negativo',
         case when exists (select 1 from pg_constraint
                            where conname='products_estoque_nao_negativo')
              then 'OK' else 'FALHA' end, ''
) t order by n;

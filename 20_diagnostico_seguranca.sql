-- ============================================================
-- 20_diagnostico_seguranca.sql
--
-- SÓ LÊ. Não altera nada.
--
-- O projeto tem 72 arquivos .sql acumulados, muitos se contradizem,
-- e não dá para saber quais rodaram nem em que ordem. Política de
-- segurança escrita em arquivo não protege nada — o que protege é o
-- que está VIVO no banco.
--
-- Rode isto e me mande o resultado das 6 consultas. É com ele que eu
-- sei o que está realmente aberto.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A pergunta mais importante: RLS está LIGADO em cada tabela?
--
-- Tabela com RLS desligado está 100% aberta pela API do Supabase,
-- mesmo que existam policies bonitas escritas nela. Qualquer pessoa
-- com a chave anônima (que está publicada no site) lê e escreve.
-- ------------------------------------------------------------
select
  c.relname                as tabela,
  c.relrowsecurity         as rls_ligado,
  c.relforcerowsecurity    as rls_forcado,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- ------------------------------------------------------------
-- 2. Todas as policies vivas, e para QUEM valem.
--
-- roles = {public} significa que vale também para "anon", ou seja,
-- para qualquer visitante sem login.
-- ------------------------------------------------------------
select
  tablename  as tabela,
  policyname as policy,
  cmd        as comando,
  roles,
  qual       as condicao_leitura,
  with_check as condicao_escrita
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ------------------------------------------------------------
-- 3. O que o papel anônimo pode fazer em cada tabela.
--
-- Isto é permissão de TABELA, anterior ao RLS. Se aqui aparecer
-- INSERT/UPDATE/DELETE para anon numa tabela sensível, o RLS é a
-- única coisa segurando.
-- ------------------------------------------------------------
select
  table_name as tabela,
  grantee    as papel,
  string_agg(privilege_type, ', ' order by privilege_type) as permissoes
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- ------------------------------------------------------------
-- 4. Views: elas furam o RLS por padrão.
--
-- View no Postgres roda com os poderes de quem a criou, e não de
-- quem consulta, a menos que tenha security_invoker ligado. Uma view
-- sobre uma tabela protegida devolve TUDO, de TODAS as lojas.
-- ------------------------------------------------------------
select
  c.relname as view,
  coalesce(
    (select option_value from pg_options_to_table(c.reloptions)
      where option_name = 'security_invoker'),
    'off'
  ) as security_invoker
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by c.relname;

-- ------------------------------------------------------------
-- 5. Funções security definer: rodam com poder de dono.
--
-- Cada uma dessas ignora RLS. Precisa ter search_path fixo e ser
-- executável só por quem deve.
-- ------------------------------------------------------------
select
  p.proname                as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  p.prosecdef              as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '(sem search_path)') as config,
  array_to_string(p.proacl, ' | ') as permissoes
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

-- ------------------------------------------------------------
-- 6. Storage: buckets públicos e suas policies.
-- ------------------------------------------------------------
select id as bucket, public as publico, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select
  policyname as policy,
  cmd        as comando,
  roles,
  qual       as condicao_leitura,
  with_check as condicao_escrita
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;

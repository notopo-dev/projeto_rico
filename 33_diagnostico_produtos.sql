-- ============================================================
-- Diagnóstico · por que os produtos não carregam — SÓ LEITURA
--
-- Não altera nada. Pode rodar com a loja aberta.
--
-- A loja já abre, mas toda consulta de produto responde
--   "permission denied for table stores"
--
-- Ou seja: a REGRA de segurança de `products` consulta `stores`, e
-- esbarra numa coluna que o visitante não pode ler. Preciso ver qual
-- coluna e qual regra, em vez de adivinhar.
--
-- Rode e me mande o resultado inteiro.
-- ============================================================

with bloqueadas as (
  select 1 as ordem,
         'coluna de stores que o visitante NAO le' as secao,
         c.column_name as item,
         '' as detalhe
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'stores'
     and not has_column_privilege('anon', 'public.stores', c.column_name, 'SELECT')
),

regras as (
  select 2,
         'regra de ' || p.tablename,
         p.policyname,
         concat_ws(' | ',
           'para: ' || array_to_string(p.roles, ','),
           'cmd: ' || p.cmd,
           'using: ' || coalesce(p.qual, '-'),
           'check: ' || coalesce(p.with_check, '-')
         )
    from pg_policies p
   where p.schemaname = 'public'
     and p.tablename in ('products', 'categories', 'product_images',
                         'product_colors', 'product_sizes')
),

-- O visitante consegue sequer tocar nas tabelas de produto?
-- Separa "a regra barra" de "a tabela nem está liberada".
permissoes as (
  select 3,
         'o visitante pode LER a tabela',
         t.tabela,
         case when has_table_privilege('anon', 'public.' || t.tabela, 'SELECT')
              then 'sim' else 'NAO' end
    from unnest(array['stores','products','categories','product_images',
                      'product_colors','product_sizes']) as t(tabela)
)

select secao, item, detalhe
  from (
    select * from bloqueadas
    union all select * from regras
    union all select * from permissoes
  ) tudo
 order by ordem, item;

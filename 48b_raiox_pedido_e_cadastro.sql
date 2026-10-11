-- ============================================================
-- 48b — COMO A LOJA NASCE E COMO O PEDIDO É CRIADO
--       (SOMENTE LEITURA)
--
-- Não cria, não altera e não apaga nada.
--
-- Duas coisas que eu preciso ver antes de escrever a migração:
--
--   1. Quem insere a linha em `stores` quando alguém se cadastra.
--      Se for um gatilho SECURITY DEFINER, posso tirar o INSERT
--      do lojista sem quebrar o cadastro. Se for o navegador,
--      não posso.
--
--   2. O corpo do `criar_pedido_publico`. Ele já confere `ativo`;
--      preciso ver ONDE, para encaixar a checagem de assinatura
--      no mesmo lugar em vez de criar um segundo caminho.
-- ============================================================

with
-- ---------- gatilhos que criam loja a partir do usuário ----------
gatilhos_auth as (
  select
    'A. gatilho em auth.users' as bloco,
    t.tgname as item,
    p.proname || '()  ' ||
      case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end
      as detalhe
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
),

-- ---------- qualquer função que insira em stores ----------
inserem_loja as (
  select
    'B. função que insere em stores' as bloco,
    p.proname as item,
    case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end
      || '  (dono: ' || pg_get_userbyid(p.proowner) || ')' as detalhe
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','auth')
    and p.prosrc ~* 'insert\s+into\s+(public\.)?stores'
),

-- ---------- gatilhos na própria stores ----------
gatilhos_stores as (
  select
    'C. gatilho em stores' as bloco,
    t.tgname as item,
    p.proname || '()' as detalhe
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public' and c.relname = 'stores' and not t.tgisinternal
),

-- ---------- onde criar_pedido_publico olha "ativo" ----------
-- Numera as linhas do corpo da função e devolve só as que
-- interessam, para eu ver o contexto sem despejar a função toda.
linhas as (
  select
    'D. criar_pedido_publico' as bloco,
    lpad(n::text, 4, '0') || '  (linha)' as item,
    linha as detalhe
  from (
    select p.prosrc from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'criar_pedido_publico'
    limit 1
  ) f,
  lateral unnest(string_to_array(f.prosrc, E'\n')) with ordinality as t(linha, n)
  where linha ~* '\mativo\M|\mstore\M.*not found|loja|raise exception'
),

tamanho as (
  select
    'E. tamanho' as bloco,
    'criar_pedido_publico' as item,
    array_length(string_to_array(p.prosrc, E'\n'), 1)::text || ' linhas' as detalhe
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'criar_pedido_publico'
)

select * from (
  select * from gatilhos_auth
  union all select * from inserem_loja
  union all select * from gatilhos_stores
  union all select * from linhas
  union all select * from tamanho
) tudo
order by bloco, item;

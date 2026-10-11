-- ============================================================
-- 48 — RAIO-X DA ASSINATURA   (SOMENTE LEITURA)
--
-- Não cria, não altera e não apaga nada. Pode rodar a qualquer
-- hora, inclusive com loja vendendo.
--
-- Uma consulta só, porque o editor do Supabase mostra apenas o
-- resultado do último comando.
--
-- O que eu preciso saber antes de escrever a migração de verdade:
--   1. quais colunas de cobrança existem HOJE em stores
--   2. se o lojista consegue escrever nelas pelo navegador
--      (se conseguir, ele se dá assinatura ativa de graça)
--   3. o que já existe de função/gatilho com nome de assinatura
--   4. se criar_pedido_publico olha o status da loja
-- ============================================================

with
-- ---------- A. colunas de cobrança em stores ----------
colunas as (
  select
    'A. coluna' as bloco,
    column_name as item,
    data_type
      || case when is_nullable = 'NO' then ' NOT NULL' else '' end
      || coalesce(' default ' || column_default, '') as detalhe
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'stores'
    and (
      column_name ~ 'assinatura|plano|trial|teste|cobranca|billing'
      or column_name in (
        'stripe_customer_id','stripe_subscription_id',
        'stripe_payment_method_id','stripe_billing_habilitado',
        'stripe_account_id','stripe_charges_enabled','ativo'
      )
    )
),

-- ---------- B. restrições (CHECK) ----------
restricoes as (
  select
    'B. restrição' as bloco,
    con.conname as item,
    pg_get_constraintdef(con.oid) as detalhe
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'stores'
    and pg_get_constraintdef(con.oid) ~* 'assinatura|plano|trial|teste'
),

-- ---------- C. o que está gravado hoje ----------
situacao as (
  select
    'C. lojas' as bloco,
    'assinatura_status = ' || coalesce(assinatura_status::text, '(nulo)') as item,
    count(*)::text || ' loja(s)' as detalhe
  from public.stores
  group by assinatura_status
),

assinaturas as (
  select
    'C. lojas' as bloco,
    'com stripe_subscription_id' as item,
    count(*) filter (where stripe_subscription_id is not null)::text
      || ' de ' || count(*)::text as detalhe
  from public.stores
),

contas as (
  select
    'C. lojas' as bloco,
    'com conta de recebimento pronta' as item,
    count(*) filter (where stripe_charges_enabled)::text
      || ' de ' || count(*)::text as detalhe
  from public.stores
),

-- ---------- D. quem pode ESCREVER em stores ----------
-- Esta é a parte que mais importa. Se o lojista tem UPDATE livre
-- em stores, ele muda assinatura_status pelo navegador e usa de
-- graça para sempre. Nenhuma tela de cobrança resolve isso.
politicas as (
  select
    'D. política RLS' as bloco,
    policyname || '  [' || cmd || ']' as item,
    'para ' || array_to_string(roles, ',')
      || coalesce('  USING ' || qual, '')
      || coalesce('  CHECK ' || with_check, '') as detalhe
  from pg_policies
  where schemaname = 'public' and tablename = 'stores'
),

concessoes as (
  select
    'D. grant' as bloco,
    grantee || ' → ' || privilege_type as item,
    'tabela stores' as detalhe
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'stores'
    and grantee in ('anon','authenticated','public')
),

rls_ligada as (
  select
    'D. grant' as bloco,
    'RLS ligada em stores?' as item,
    case when c.relrowsecurity then 'SIM' else 'NÃO — qualquer um escreve' end as detalhe
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'stores'
),

-- ---------- E. gatilhos em stores ----------
gatilhos as (
  select
    'E. gatilho' as bloco,
    t.tgname as item,
    p.proname || '()' as detalhe
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public' and c.relname = 'stores' and not t.tgisinternal
),

-- ---------- F. funções já existentes sobre assinatura ----------
funcoes as (
  select
    'F. função' as bloco,
    p.proname as item,
    pg_get_function_identity_arguments(p.oid) as detalhe
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname ~ 'assinatura|plano|trial|teste|mensalidade'
),

-- ---------- G. criar_pedido_publico olha o status da loja? ----------
pedido as (
  select
    'G. checkout' as bloco,
    'criar_pedido_publico menciona assinatura/plano/ativo?' as item,
    case
      when p.prosrc ~* 'assinatura' then 'SIM — menciona assinatura'
      when p.prosrc ~* '\mativo\M'  then 'parcial — menciona ativo'
      else 'NÃO — vende mesmo sem assinatura'
    end as detalhe
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'criar_pedido_publico'
),

-- ---------- H. a loja pública olha "ativo"? ----------
loja_publica as (
  select
    'H. loja pública' as bloco,
    'lojas com ativo = false' as item,
    count(*) filter (where not ativo)::text || ' de ' || count(*)::text as detalhe
  from public.stores
)

select * from (
  select * from colunas
  union all select * from restricoes
  union all select * from situacao
  union all select * from assinaturas
  union all select * from contas
  union all select * from politicas
  union all select * from concessoes
  union all select * from rls_ligada
  union all select * from gatilhos
  union all select * from funcoes
  union all select * from pedido
  union all select * from loja_publica
) tudo
order by bloco, item;

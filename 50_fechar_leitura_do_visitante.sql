-- ============================================================
-- 50 — O VISITANTE VOLTA A LER SÓ O QUE A VITRINE PRECISA
--
-- Não apaga nada. Pode rodar mais de uma vez.
--
-- ------------------------------------------------------------
-- O que está errado hoje
-- ------------------------------------------------------------
-- A conferência da migração 49 acusou:
--
--     visitante consegue ler o status da assinatura → SIM
--
-- Ou seja: `anon` tem SELECT na TABELA inteira, não por coluna.
-- Qualquer pessoa com a chave anônima (que está no código do site,
-- por desenho) consegue pedir qualquer coluna de `stores` —
-- incluindo owner_id, e-mail, stripe_account_id,
-- stripe_customer_id, stripe_payment_method_id e a situação
-- financeira de cada lojista.
--
-- O arquivo 32_permissao_colunas_loja.sql mostra que um dia isso
-- era por coluna. Em algum momento alguém rodou um
-- `grant select on public.stores to anon` sem lista e anulou a
-- restrição inteira. Não dá para saber quando pelo catálogo.
--
-- ------------------------------------------------------------
-- Por que a lista é exatamente esta
-- ------------------------------------------------------------
-- São as 25 colunas do único SELECT que o lado público faz em
-- `stores` — `getStoreBySlug`, em src/store/lib/storeApi.ts.
-- Conferidas uma a uma contra o código, não de memória.
--
-- O resto do sistema não se abala: o painel é `authenticated` e as
-- Edge Functions usam a chave de serviço, que não passa por grant.
--
-- ⚠️ No Postgres a consulta INTEIRA é recusada quando UMA coluna
-- pedida é proibida — o erro 42501 vira "Loja não encontrada" na
-- tela. Foi o apagão de 01/10. Por isso esta migração termina
-- RODANDO a consulta da vitrine como visitante, em vez de supor
-- que deu certo.
-- ============================================================

begin;

-- Derruba o SELECT de tabela (e, junto, qualquer resto por coluna).
revoke select on public.stores from anon;

-- Devolve só o que a vitrine lê.
grant select (
  id,
  nome,
  slug,
  descricao,
  logo_url,
  banner_url,
  cor_primaria,
  cor_secundaria,
  whatsapp,
  email,
  politica_troca,
  politica_frete,
  modo_compra,
  ativo,
  aceita_cartao,
  aceita_pix,
  frete_modo,
  frete_fixo,
  frete_fixo_prazo_dias,
  frete_fixo_nome,
  frete_gratis_acima,
  retirada_na_loja,
  retirada_instrucoes,
  retirada_aceita_dinheiro,
  retirada_aceita_maquininha
) on public.stores to anon;

commit;

-- ============================================================
-- Conferência — roda como VISITANTE de verdade
-- ============================================================
do $$
declare
  v_ok        boolean := false;
  v_erro      text;
  v_vazou     text;
  v_definer   text;
begin
  -- ---------- 1. a vitrine ainda abre? ----------
  set local role anon;
  begin
    perform
      id, nome, slug, descricao, logo_url, banner_url, cor_primaria,
      cor_secundaria, whatsapp, email, politica_troca, politica_frete,
      modo_compra, ativo, aceita_cartao, aceita_pix, frete_modo,
      frete_fixo, frete_fixo_prazo_dias, frete_fixo_nome,
      frete_gratis_acima, retirada_na_loja, retirada_instrucoes,
      retirada_aceita_dinheiro, retirada_aceita_maquininha
    from public.stores
    limit 1;
    v_ok := true;
  exception when others then
    v_erro := sqlerrm;
  end;

  -- ---------- 2. o que ainda vaza? ----------
  begin
    perform assinatura_status from public.stores limit 1;
    v_vazou := 'assinatura_status';
  exception when insufficient_privilege then
    null;
  end;

  if v_vazou is null then
    begin
      perform owner_id from public.stores limit 1;
      v_vazou := 'owner_id';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  if v_vazou is null then
    begin
      perform stripe_account_id from public.stores limit 1;
      v_vazou := 'stripe_account_id';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  reset role;

  -- ---------- 3. o domínio próprio depende de grant? ----------
  select case when p.prosecdef then 'SECURITY DEFINER (não depende de grant)'
              else 'SECURITY INVOKER — CONFERIR' end
    into v_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'loja_por_dominio';

  raise notice '--------------------------------------------';
  raise notice 'vitrine abre como visitante......: %',
    case when v_ok then 'SIM' else 'NÃO — ' || coalesce(v_erro, '?') end;
  raise notice 'ainda vaza coluna interna........: %',
    coalesce(v_vazou || ' — PROBLEMA', 'não (correto)');
  raise notice 'loja_por_dominio.................: %',
    coalesce(v_definer, 'função não existe');
  raise notice '--------------------------------------------';
end $$;

-- E o mesmo em tabela, para aparecer no resultado da consulta.
select
  'colunas que o visitante lê em stores' as verificacao,
  count(*)::text || ' (esperado: 25)' as resultado
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'stores'
   and grantee = 'anon' and privilege_type = 'SELECT'
union all
select
  'visitante lê status da assinatura',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'assinatura_status'
       and grantee = 'anon' and privilege_type = 'SELECT'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select
  'visitante lê owner_id',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'owner_id'
       and grantee = 'anon' and privilege_type = 'SELECT'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select
  'visitante lê dados da conta Stripe',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name like 'stripe_%'
       and grantee = 'anon' and privilege_type = 'SELECT'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end;

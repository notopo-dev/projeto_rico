-- ============================================================
-- 15_limpar_campos_mortos.sql
--
-- Remove três colunas de store_settings que nunca foram lidas por
-- nenhuma parte do sistema:
--
--   correios_login      — integração SIGEP que nunca existiu
--   pix_chave           — o Pix da loja é da Stripe, configurado em
--                         Recebimentos; esta chave não ia a lugar nenhum
--   mercado_pago_token  — provedor que o sistema não usa
--
-- Eram três caixas de texto em Configurações → Integrações que
-- gravavam no banco e não produziam efeito nenhum. A de Pix era a pior:
-- dava a entender que o Pix da loja saía dali.
--
-- ATENÇÃO: isto APAGA os dados dessas colunas, e não tem volta. Rode
-- só depois de conferir, com a consulta abaixo, que não há nada ali
-- que você queira anotar antes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Confira primeiro. Se vier tudo em branco, pode seguir.
-- ------------------------------------------------------------
select
  s.nome as loja,
  ss.correios_login,
  ss.pix_chave,
  case when ss.mercado_pago_token is null then null else '(preenchido)' end
    as mercado_pago
from public.store_settings ss
join public.stores s on s.id = ss.store_id
where ss.correios_login is not null
   or ss.pix_chave is not null
   or ss.mercado_pago_token is not null;

-- ------------------------------------------------------------
-- 2. Só então, descomente as três linhas abaixo e rode de novo.
-- ------------------------------------------------------------
-- alter table public.store_settings
--   drop column if exists correios_login,
--   drop column if exists pix_chave,
--   drop column if exists mercado_pago_token;

-- =====================================================================
-- Por que o checkout recusou — LojaPro / Money NoTopo
--
-- Rode no SQL Editor do Supabase. Só LÊ, não altera nada.
-- Compare cada linha com a coluna "esperado".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) A loja está habilitada a cobrar?
--
-- A Edge Function recusa a venda com
-- "Esta loja ainda não pode receber pagamentos com cartão"
-- quando ativo ou stripe_charges_enabled é falso, ou quando
-- stripe_account_id está vazio — mesmo que a conta já esteja
-- ativa do lado da Stripe.
-- ---------------------------------------------------------------------
select
  nome,
  ativo                          as ativo_esperado_true,
  stripe_account_id              as conta_esperado_acct,
  stripe_charges_enabled         as cobrar_esperado_true,
  stripe_payouts_enabled         as repassar_esperado_true,
  stripe_onboarding_completo,
  stripe_atualizado_em
from public.stores
order by created_at;

-- ---------------------------------------------------------------------
-- 2) O pedido que falhou
--
-- Troque o número abaixo se for outro pedido.
-- A função recusa quando o status não é 'pendente' ("Este pedido já
-- foi processado") ou quando o total não bate com o valor que a tela
-- enviou ("Valor do pagamento não confere com o pedido").
-- ---------------------------------------------------------------------
select
  o.numero,
  o.status                        as status_esperado_pendente,
  o.total,
  round(o.total * 100)            as total_em_centavos,
  o.metodo_pagamento,
  o.created_at
from public.orders o
where o.numero = '4505';

-- ---------------------------------------------------------------------
-- 3) Já existe cobrança gravada para esse pedido?
-- ---------------------------------------------------------------------
select
  p.transacao_id,
  p.metodo,
  p.valor_bruto,
  p.status,
  p.stripe_payment_intent_id,
  p.created_at
from public.payments p
join public.orders o on o.id = p.order_id
where o.numero = '4505'
order by p.created_at desc;

-- ---------------------------------------------------------------------
-- 4) As colunas do 04_pedidos_gestao.sql existem?
--
-- Se vier VAZIO, o 04 ainda não foi rodado — e o webhook vai falhar
-- ao registrar reembolso.
-- ---------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'orders'
  and column_name in ('valor_reembolsado', 'reembolsado_em', 'stripe_refund_id')
order by column_name;

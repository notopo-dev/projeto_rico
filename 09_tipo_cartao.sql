-- =====================================================================
-- Crédito ou débito, bandeira e final do cartão
-- LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. Idempotente.
--
-- POR QUE ASSIM
-- Para a Stripe, crédito e débito são o MESMO tipo de pagamento: o
-- cliente digita o cartão e o processamento é igual. Perguntar antes
-- registraria o que o cliente DISSE, não o que aconteceu — e erra
-- muito, principalmente com cartão múltiplo.
--
-- A Stripe identifica pelo BIN, no momento da cobrança, e devolve
-- isso no `payment_method_details.card`. É esse dado que fica aqui.
-- =====================================================================

alter table public.payments
  add column if not exists cartao_tipo     text,
  add column if not exists cartao_bandeira text,
  add column if not exists cartao_final    text;

comment on column public.payments.cartao_tipo is
  'credit | debit | prepaid | unknown — vem do BIN, dito pela Stripe';
comment on column public.payments.cartao_bandeira is
  'visa, mastercard, elo, amex...';
comment on column public.payments.cartao_final is
  'Últimos 4 dígitos. Não é dado sigiloso e é o que o cliente reconhece.';

-- O relatório por forma de pagamento agrupa por estas colunas.
create index if not exists idx_payments_cartao_tipo
  on public.payments (store_id, cartao_tipo)
  where cartao_tipo is not null;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'payments'
  and column_name like 'cartao%'
order by column_name;

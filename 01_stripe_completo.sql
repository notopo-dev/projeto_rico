-- =====================================================================
-- LojaPro / Money NoTopo — Stripe Connect (Accounts v2)
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
--
-- Usa os nomes de coluna que o projeto JÁ usa:
--   orders.status = 'pago'
--   payments.status = 'pendente' | 'recebido' | 'falhou'
--   stores.stripe_onboarding_completo
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PAYMENTS — garante as colunas do Stripe
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id         text,
  add column if not exists stripe_account_id        text,
  add column if not exists erro_mensagem            text;

create unique index if not exists uq_payments_stripe_pi
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ---------------------------------------------------------------------
-- 2) STORES — requisitos pendentes e mensalidade da plataforma
--    (stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
--     e stripe_onboarding_completo já existem; ficam intactos)
-- ---------------------------------------------------------------------
alter table public.stores
  add column if not exists stripe_requisitos_pendentes jsonb   default '[]'::jsonb,
  add column if not exists stripe_billing_habilitado   boolean default false,
  add column if not exists stripe_atualizado_em        timestamptz,
  add column if not exists stripe_subscription_id      text,
  add column if not exists stripe_payment_method_id    text,
  add column if not exists assinatura_status           text default 'sem_assinatura',
  add column if not exists assinatura_proxima_cobranca timestamptz,
  add column if not exists assinatura_plano            text;

-- assinatura_status: sem_assinatura | incompleta | ativa | inadimplente | cancelada

create unique index if not exists uq_stores_stripe_account
  on public.stores (stripe_account_id)
  where stripe_account_id is not null;

-- ---------------------------------------------------------------------
-- 3) Log de eventos do Stripe — evita processar o mesmo evento 2x
--    se a Stripe reenviar (ela reenvia em caso de timeout).
-- ---------------------------------------------------------------------
create table if not exists public.stripe_events (
  id            text primary key,        -- evt_... vindo da Stripe
  tipo          text not null,
  payload       jsonb,
  processado_em timestamptz not null default now()
);

alter table public.stripe_events enable row level security;

-- Só as Edge Functions (service_role) tocam nessa tabela.
drop policy if exists "stripe_events_sem_acesso_publico" on public.stripe_events;
create policy "stripe_events_sem_acesso_publico"
  on public.stripe_events for select
  using (false);

-- ---------------------------------------------------------------------
-- 4) Conferência — o resultado deve listar as colunas acima
-- ---------------------------------------------------------------------
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('payments', 'stores')
  and (column_name like 'stripe%' or column_name like 'assinatura%')
order by table_name, column_name;

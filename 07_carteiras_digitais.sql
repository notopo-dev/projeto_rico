-- =====================================================================
-- Carteiras digitais (Apple Pay / Google Pay) — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. Idempotente.
--
-- Apple Pay e Google Pay não têm tipo próprio na API da Stripe: são
-- maneiras de entregar um cartão. O Payment Element mostra os botões
-- sozinho, desde que o DOMÍNIO da loja esteja registrado na conta
-- conectada do lojista. Estas colunas guardam se isso já foi feito.
-- =====================================================================

alter table public.stores
  add column if not exists stripe_dominio_registrado text,
  add column if not exists stripe_carteiras_ativas   boolean not null default false;

comment on column public.stores.stripe_dominio_registrado is
  'Domínio registrado na conta Connect para liberar Apple Pay e Google Pay';
comment on column public.stores.stripe_carteiras_ativas is
  'A Stripe confirmou a validação do domínio para pelo menos uma carteira';

select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stores'
  and column_name in ('stripe_dominio_registrado', 'stripe_carteiras_ativas')
order by column_name;

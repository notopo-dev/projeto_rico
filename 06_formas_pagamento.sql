-- =====================================================================
-- Formas de pagamento da loja — LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase.
-- Idempotente.
--
-- POR QUE ISTO EXISTE
-- O checkout oferecia Pix e cartão sempre, chumbado no código, sem
-- olhar se a conta do lojista tinha aquilo liberado. O cliente
-- escolhia Pix, ia até o fim, e só então a Stripe recusava com uma
-- mensagem em inglês. O lojista não tinha onde dizer o que aceita.
--
-- São duas coisas diferentes, e as duas precisam ser verdade:
--   1. a Stripe liberou aquele meio para a conta  (capacidade)
--   2. o lojista quer oferecer aquele meio        (estas colunas)
-- =====================================================================

alter table public.stores
  add column if not exists aceita_cartao boolean not null default true,
  add column if not exists aceita_pix    boolean not null default false;

comment on column public.stores.aceita_pix is
  'O lojista quer oferecer Pix. Só vale se a conta Stripe tiver a capacidade liberada.';
comment on column public.stores.aceita_cartao is
  'O lojista quer oferecer cartão.';

-- Pix começa desligado de propósito: no Brasil ele exige ativação à
-- parte na Stripe. Ligado por padrão, toda loja nova quebraria no
-- checkout exatamente como quebrou aqui.

-- ---------------------------------------------------------------------
-- A vitrine pública lê estas colunas sem login. O select público de
-- stores já existe; este bloco só confirma que ele está lá — sem ele,
-- o checkout não saberia o que oferecer.
-- ---------------------------------------------------------------------
select
  c.relname as tabela,
  p.polname as politica,
  p.polcmd  as comando
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'stores'
order by p.polcmd, p.polname;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stores'
  and column_name in ('aceita_cartao', 'aceita_pix')
order by column_name;

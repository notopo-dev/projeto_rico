-- ============================================================
-- 14_frete.sql
--
-- Regras de frete da própria loja.
--
-- Até aqui o frete só existia via Melhor Envio: sem conta lá, o
-- checkout caía em "frete a combinar" e pronto. Isso trava quem está
-- começando — a maioria dos lojistas cobra um valor fixo, ou dá frete
-- grátis acima de um valor, ou entrega na mão.
--
-- Tudo isto mora em `stores`, e não em `store_settings`, de propósito:
-- a loja pública precisa LER estas regras sem login, e store_settings
-- é fechada só para o dono (é onde mora o token do Melhor Envio).
-- Nada aqui é segredo — é preço de frete, que o cliente vai ver de
-- qualquer jeito.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

alter table public.stores
  add column if not exists frete_modo text,
  add column if not exists frete_fixo numeric(10,2),
  add column if not exists frete_fixo_prazo_dias integer,
  add column if not exists frete_fixo_nome text,
  add column if not exists frete_gratis_acima numeric(10,2),
  add column if not exists retirada_na_loja boolean,
  add column if not exists retirada_instrucoes text;

-- Padrões. Feito em passo separado do `add column` para que lojas que
-- já existem também recebam o valor, e não só as criadas daqui pra
-- frente.
alter table public.stores
  alter column frete_modo set default 'combinar',
  alter column retirada_na_loja set default false;

update public.stores
   set frete_modo = 'combinar'
 where frete_modo is null;

update public.stores
   set retirada_na_loja = false
 where retirada_na_loja is null;

alter table public.stores
  alter column frete_modo set not null,
  alter column retirada_na_loja set not null;

-- ------------------------------------------------------------
-- Travas
--
-- Frete negativo, prazo negativo e "grátis acima de zero" são erros de
-- digitação que passariam direto e só apareceriam como preço errado na
-- loja. O banco recusa.
-- ------------------------------------------------------------
alter table public.stores
  drop constraint if exists stores_frete_modo_check,
  drop constraint if exists stores_frete_fixo_check,
  drop constraint if exists stores_frete_fixo_prazo_check,
  drop constraint if exists stores_frete_gratis_check;

alter table public.stores
  add constraint stores_frete_modo_check
    check (frete_modo in ('melhor_envio', 'fixo', 'combinar')),
  add constraint stores_frete_fixo_check
    check (frete_fixo is null or frete_fixo >= 0),
  add constraint stores_frete_fixo_prazo_check
    check (frete_fixo_prazo_dias is null or frete_fixo_prazo_dias between 0 and 180),
  add constraint stores_frete_gratis_check
    check (frete_gratis_acima is null or frete_gratis_acima > 0);

comment on column public.stores.frete_modo is
  'Como a loja cobra o frete: melhor_envio (tabela das transportadoras), fixo (valor único definido pelo lojista) ou combinar (acerta com o cliente depois)';
comment on column public.stores.frete_gratis_acima is
  'Subtotal a partir do qual o frete sai de graça. NULL = desligado. Vale para os três modos.';
comment on column public.stores.retirada_na_loja is
  'Oferece retirar no balcão, sem frete e sem endereço de entrega';

-- ------------------------------------------------------------
-- Conferência
-- ------------------------------------------------------------
select
  nome,
  frete_modo,
  frete_fixo,
  frete_fixo_prazo_dias,
  frete_gratis_acima,
  retirada_na_loja,
  cep_origem is not null as tem_cep_origem
from public.stores
order by created_at;

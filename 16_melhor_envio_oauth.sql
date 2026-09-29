-- ============================================================
-- 16_melhor_envio_oauth.sql
--
-- O Melhor Envio tirou os tokens pessoais do painel: hoje a API deles
-- é OAuth 2.0 e nada mais. Não existe mais token para o lojista copiar
-- e colar — ele autoriza a Money NoTopo numa tela do Melhor Envio e
-- nós recebemos o token de volta.
--
-- Isso traz uma obrigação nova, que é o motivo destas colunas:
--
--   access_token   vale 30 dias
--   refresh_token  vale 45 dias
--
-- Ou seja: sem renovar sozinho, TODA loja conectada para de cotar
-- frete depois de um mês. E se passar de 45 dias sem renovar, nem o
-- refresh salva — o lojista tem que autorizar de novo na mão. Por isso
-- guardamos a validade: é ela que diz quando renovar antes de quebrar.
--
-- Tudo em store_settings, que o RLS abre só para o dono da loja.
-- Estes campos autorizam gastar o saldo do Melhor Envio da pessoa —
-- não podem chegar nem perto do navegador de quem compra.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

alter table public.store_settings
  -- Renova o access_token sem pedir nada ao lojista.
  add column if not exists melhor_envio_refresh_token text,
  -- Quando o access_token vence. Renovamos alguns dias antes.
  add column if not exists melhor_envio_expira_em timestamptz,
  -- Nome da conta autorizada, só para a tela mostrar quem está ligado.
  add column if not exists melhor_envio_conta text,
  -- Protege o retorno da autorização (o "state" do OAuth): garante que
  -- o código que voltou é da conexão que ESTA loja começou, e não de um
  -- link montado por outra pessoa para grudar a conta dela na loja
  -- alheia.
  add column if not exists melhor_envio_state text,
  add column if not exists melhor_envio_state_em timestamptz;

comment on column public.store_settings.melhor_envio_expira_em is
  'Validade do access_token. A renovação automática usa isto para agir ANTES de vencer — depois de 45 dias sem renovar, o lojista precisa reconectar na mão.';
comment on column public.store_settings.melhor_envio_state is
  'Valor aleatório do OAuth, válido por poucos minutos, conferido na volta da autorização.';

-- ------------------------------------------------------------
-- Conferência
-- ------------------------------------------------------------
select
  s.nome as loja,
  ss.melhor_envio_ambiente,
  ss.melhor_envio_token is not null      as tem_acesso,
  ss.melhor_envio_refresh_token is not null as tem_refresh,
  ss.melhor_envio_expira_em,
  ss.melhor_envio_conta
from public.store_settings ss
join public.stores s on s.id = ss.store_id
order by s.created_at;

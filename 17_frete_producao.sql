-- ============================================================
-- 17_frete_producao.sql
--
-- O ambiente do Melhor Envio (teste ou produção) deixou de aparecer no
-- painel. Era uma decisão da PLATAFORMA aparecendo como se fosse do
-- lojista: quem vende camisa não tem por que saber o que é sandbox, e
-- a única coisa que podia fazer com aquele botão era desligar a
-- própria loja sem entender o motivo.
--
-- A coluna continua existindo, e o código continua lendo. Não é resto
-- esquecido: é como VOCÊ liga o sandbox numa loja de teste, mudando um
-- valor aqui, sem alterar código nem mostrar nada ao lojista.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- Novas lojas nascem em produção.
alter table public.store_settings
  alter column melhor_envio_ambiente set default 'producao';

-- As que já existem passam para produção — menos quem estiver
-- conectado no sandbox agora, porque trocar o ambiente por baixo
-- invalidaria a autorização e a loja pararia de cotar frete sem
-- ninguém entender por quê.
update public.store_settings
   set melhor_envio_ambiente = 'producao'
 where coalesce(melhor_envio_ambiente, 'sandbox') <> 'producao'
   and melhor_envio_token is null;

comment on column public.store_settings.melhor_envio_ambiente is
  'sandbox ou producao. Não aparece no painel: é alavanca da plataforma, alterada aqui no banco quando se quer testar uma loja sem gastar saldo.';

-- ------------------------------------------------------------
-- Conferência
-- ------------------------------------------------------------
select
  s.nome as loja,
  ss.melhor_envio_ambiente,
  ss.melhor_envio_token is not null as conectado,
  ss.melhor_envio_conta
from public.store_settings ss
join public.stores s on s.id = ss.store_id
order by s.created_at;

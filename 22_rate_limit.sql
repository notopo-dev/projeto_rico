-- ============================================================
-- 22_rate_limit.sql
--
-- Limite de requisições, no servidor.
--
-- Hoje nenhuma das 15 Edge Functions tem limite nenhum. As que ficam
-- abertas sem login são as que doem:
--
--   frete-calcular              gasta a cota do Melhor Envio do lojista
--   frete-rastrear              consulta identidade por CPF + telefone
--   stripe-create-payment-intent  cria cobrança na conta do lojista
--
-- Sem limite, dá para rodar qualquer uma delas em laço a partir de
-- qualquer navegador: queimar o token do Melhor Envio da loja, varrer
-- CPFs para descobrir quem é cliente, ou encher a Stripe do lojista de
-- cobranças abandonadas.
--
-- O contador mora no banco de propósito: Edge Function não tem memória
-- entre chamadas, e cada invocação pode cair numa máquina diferente.
-- Contador em memória não conta nada.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

create table if not exists public.rate_limit (
  chave        text        not null,
  janela_em    timestamptz not null,
  tentativas   integer     not null default 0,
  primary key (chave, janela_em)
);

comment on table public.rate_limit is
  'Contador de requisições por chave e janela de tempo. Escrito apenas por Edge Functions (service role).';

-- Ninguém além do service role encosta nisto.
alter table public.rate_limit enable row level security;
revoke all on public.rate_limit from anon, authenticated;

create index if not exists idx_rate_limit_janela
  on public.rate_limit (janela_em);

/**
 * Registra uma tentativa e diz se ainda está dentro do limite.
 *
 * Devolve true  = pode seguir
 *         false = estourou o limite
 *
 * A janela é fixa (não deslizante): simples, previsível, e o
 * suficiente para conter laço automatizado. `on conflict do update`
 * faz a conta ser atômica — duas requisições ao mesmo tempo não
 * conseguem ler o mesmo valor e passar as duas.
 */
create or replace function public.consumir_limite(
  p_chave    text,
  p_max      integer,
  p_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_janela timestamptz;
  v_total  integer;
begin
  if p_chave is null or btrim(p_chave) = '' then
    return true;  -- sem chave não dá para contar; não trava o fluxo
  end if;

  -- Início da janela atual
  v_janela := to_timestamp(
    floor(extract(epoch from now()) / greatest(p_segundos, 1)) * greatest(p_segundos, 1)
  );

  insert into public.rate_limit (chave, janela_em, tentativas)
  values (p_chave, v_janela, 1)
  on conflict (chave, janela_em)
  do update set tentativas = public.rate_limit.tentativas + 1
  returning tentativas into v_total;

  -- Limpeza preguiçosa: de vez em quando apaga janelas velhas, para a
  -- tabela não virar um depósito. Sem cron, sem job externo.
  if random() < 0.01 then
    delete from public.rate_limit where janela_em < now() - interval '1 day';
  end if;

  return v_total <= p_max;
end;
$$;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;

-- ------------------------------------------------------------
-- Conferência
-- ------------------------------------------------------------
select
  'rate_limit criada' as item,
  (select relrowsecurity from pg_class where relname = 'rate_limit') as rls_ligado;

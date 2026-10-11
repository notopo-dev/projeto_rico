-- ============================================================
-- 49 — MENSALIDADE: TESTE DE 1 DIA, TRAVA E COLUNAS FECHADAS
--
-- Não apaga tabela, não apaga dado, não remove funcionalidade.
-- Pode rodar duas vezes seguidas sem efeito diferente.
--
-- ------------------------------------------------------------
-- Por que esta migração existe
-- ------------------------------------------------------------
-- A página de vendas já promete "teste 1 dia" e "assine por R$ 78",
-- e o banco não tinha nem uma coisa nem outra. Pior: a política
-- `owner_full_access_stores` é FOR ALL e o papel `authenticated`
-- tinha UPDATE na tabela inteira. RLS no Postgres decide QUAIS
-- LINHAS, nunca QUAIS COLUNAS — então o lojista fazia isto no
-- console do próprio navegador:
--
--     supabase.from("stores").update({ assinatura_status: "ativa" })
--
-- e usava de graça para sempre. Qualquer tela de cobrança
-- construída antes disso estaria apoiada em nada.
--
-- ------------------------------------------------------------
-- Onde fica a trava
-- ------------------------------------------------------------
-- Em gatilho, não em tela e não dentro do `criar_pedido_publico`.
-- Gatilho dispara para TODO mundo — inclusive para código rodando
-- como SECURITY DEFINER, que é o caso do checkout. Então protege
-- qualquer caminho que crie pedido, hoje e no futuro, sem eu
-- precisar reescrever uma função de 407 linhas às cegas.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Colunas novas
-- ------------------------------------------------------------
alter table public.stores
  add column if not exists teste_termina_em        timestamptz,
  add column if not exists assinatura_cancelada_em timestamptz;

-- A isenção nasce junto com a cobrança e vale para sempre: é o que
-- permite comprar a demo, dar cortesia e não cobrar de si mesmo.
--
-- O `update` só roda quando a coluna ACABOU de ser criada. Se
-- estivesse solto, rodar a migração de novo daria cortesia para
-- todas as lojas que entraram depois — de graça e em silêncio.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'isenta_de_mensalidade'
  ) then
    alter table public.stores
      add column isenta_de_mensalidade boolean not null default false;

    update public.stores set isenta_de_mensalidade = true;

    raise notice 'Cortesia dada às % loja(s) que já existiam antes da cobrança.',
      (select count(*) from public.stores);
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. O CHECK precisa aceitar os estados novos
-- ------------------------------------------------------------
-- 'teste'    = dentro do dia grátis
-- 'expirada' = o dia acabou e ninguém assinou
--
-- 'inadimplente' continua operando de propósito: é o período em que
-- a Stripe ainda está retentando o cartão. Derrubar a loja no
-- primeiro "não autorizado" castiga quem só trocou de cartão.
alter table public.stores
  drop constraint if exists stores_assinatura_status_check;

alter table public.stores
  add constraint stores_assinatura_status_check
  check (assinatura_status = any (array[
    'sem_assinatura','teste','expirada','ativa','inadimplente','cancelada'
  ]));

-- ------------------------------------------------------------
-- 3. Fonte única de verdade: esta loja pode operar?
-- ------------------------------------------------------------
-- STABLE e SECURITY DEFINER: precisa enxergar a linha mesmo quando
-- quem pergunta é o visitante anônimo, que só lê loja ativa.
create or replace function public.loja_pode_operar(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select s.isenta_de_mensalidade
        or s.assinatura_status in ('ativa', 'inadimplente')
        or (s.assinatura_status = 'teste' and s.teste_termina_em > now())
      from public.stores s
     where s.id = p_store_id
  ), false);
$$;

comment on function public.loja_pode_operar(uuid) is
  'Única resposta para "esta loja pode vender?". Usada pelo gatilho de pedidos e pela política de leitura pública. Não leia assinatura_status direto em tela nenhuma.';

revoke all on function public.loja_pode_operar(uuid) from public;
grant execute on function public.loja_pode_operar(uuid) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Toda loja nova nasce em teste de 1 dia
-- ------------------------------------------------------------
-- Em gatilho, e não no `handle_new_user`, porque assim vale para
-- qualquer jeito de criar loja — inclusive um que ainda não existe.
create or replace function public.iniciar_teste_da_loja()
returns trigger
language plpgsql
as $$
begin
  if new.assinatura_status is null
     or new.assinatura_status = 'sem_assinatura' then
    new.assinatura_status := 'teste';
    new.teste_termina_em  := now() + interval '1 day';
  end if;
  return new;
end $$;

drop trigger if exists stores_iniciar_teste on public.stores;
create trigger stores_iniciar_teste
  before insert on public.stores
  for each row execute function public.iniciar_teste_da_loja();

-- ------------------------------------------------------------
-- 5. A trava: loja sem assinatura não cria pedido
-- ------------------------------------------------------------
create or replace function public.exigir_assinatura_no_pedido()
returns trigger
language plpgsql
as $$
begin
  if not public.loja_pode_operar(new.store_id) then
    -- Mensagem igual à que o checkout já dá quando a loja está
    -- inativa. O cliente que está comprando não tem nada com a
    -- situação financeira da loja — e contar isso para ele seria
    -- expor o lojista.
    raise exception 'Loja indisponível no momento.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists orders_exigir_assinatura on public.orders;
create trigger orders_exigir_assinatura
  before insert on public.orders
  for each row execute function public.exigir_assinatura_no_pedido();

-- ------------------------------------------------------------
-- 6. Loja sem assinatura some da vitrine
-- ------------------------------------------------------------
-- O `ativo` continua sendo do lojista: é com ele que ele pausa a
-- própria loja quando quiser. Ele só não é mais suficiente para
-- MANTER a loja no ar.
drop policy if exists public_read_active_stores on public.stores;
create policy public_read_active_stores on public.stores
  for select to public
  using (ativo = true and public.loja_pode_operar(id));

-- ------------------------------------------------------------
-- 7. O lojista perde a caneta nas colunas de cobrança
-- ------------------------------------------------------------
-- RLS não resolve isto: ela filtra linha. Quem filtra coluna é
-- GRANT UPDATE (coluna), que é o que fazemos aqui.
--
-- A lista é montada ao contrário — tudo é liberado, MENOS o que
-- for de cobrança. Assim, coluna `stripe_*` ou `assinatura_*` que
-- alguém criar amanhã já nasce fechada, sem depender de alguém
-- lembrar de voltar aqui.
do $$
declare
  v_colunas text;
begin
  select string_agg(quote_ident(column_name), ', ' order by column_name)
    into v_colunas
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'stores'
     and column_name !~ '^(stripe_|assinatura_)'
     and column_name not in (
       'id', 'owner_id', 'created_at', 'updated_at',
       'teste_termina_em', 'isenta_de_mensalidade'
     );

  if v_colunas is null then
    raise exception 'Nenhuma coluna editável encontrada em stores — abortando.';
  end if;

  -- INSERT: quem cria loja é o handle_new_user(), que roda como
  -- postgres (SECURITY DEFINER) e não passa por grant. Tirar daqui
  -- não quebra o cadastro — impede o lojista de abrir lojas extras.
  -- DELETE: apagar a loja levaria junto pedidos, clientes e
  -- histórico fiscal. Isso é suporte, não botão.
  --
  -- Revogar UPDATE da tabela derruba junto toda permissão POR
  -- COLUNA de UPDATE, que é justamente o que queremos antes de
  -- conceder a lista certa.
  execute 'revoke insert, update, delete, trigger, references on public.stores from authenticated';
  execute format('grant update (%s) on public.stores to authenticated', v_colunas);

  -- O visitante perde o que nunca precisou. TRIGGER e REFERENCES
  -- estavam concedidos sem motivo nenhum.
  --
  -- ⚠️ NÃO existe `revoke all` nem `grant select` solto aqui, e a
  -- razão está no arquivo 32_permissao_colunas_loja.sql: a leitura
  -- do visitante nesta tabela é POR COLUNA. Um `revoke all`
  -- apagaria essas concessões e um `grant select` sem lista
  -- devolveria a tabela inteira — incluindo owner_id,
  -- stripe_account_id e o status da assinatura. Seria abrir um
  -- vazamento para fechar outro. A leitura do visitante fica
  -- exatamente como está.
  execute 'revoke insert, update, delete, trigger, references on public.stores from anon';
end $$;

-- ------------------------------------------------------------
-- 8. As colunas novas precisam de permissão de LEITURA
-- ------------------------------------------------------------
-- No Postgres, coluna nova NÃO herda a permissão da tabela. Foi
-- isso que derrubou toda loja pública em 01/10 (ver o arquivo 32):
-- a consulta inteira é recusada com 42501 quando UMA das colunas
-- pedidas é proibida.
--
-- A tela de assinatura lê estas colunas. Sem as linhas abaixo ela
-- quebraria exatamente do mesmo jeito.
--
-- Só para o LOJISTA. O visitante não tem o que fazer com a
-- situação financeira da loja: quem decide se a vitrine aparece é
-- a função `loja_pode_operar`, que roda como dona e enxerga tudo
-- sem precisar abrir coluna para ninguém.
grant select (
  teste_termina_em,
  assinatura_cancelada_em,
  isenta_de_mensalidade,
  assinatura_status,
  assinatura_proxima_cobranca,
  stripe_subscription_id
) on public.stores to authenticated;

commit;

-- ============================================================
-- Conferência — roda sozinha, só leitura
-- ============================================================
select
  'teste de 1 dia ligado'                                as verificacao,
  case when exists (
    select 1 from pg_trigger
     where tgname = 'stores_iniciar_teste' and not tgisinternal
  ) then 'SIM' else 'NÃO' end                            as resultado
union all
select 'trava de pedido ligada',
  case when exists (
    select 1 from pg_trigger
     where tgname = 'orders_exigir_assinatura' and not tgisinternal
  ) then 'SIM' else 'NÃO' end
union all
select 'lojista ainda escreve em assinatura_status',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'assinatura_status'
       and grantee = 'authenticated' and privilege_type = 'UPDATE'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select 'lojista ainda escreve em nome da loja',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'nome'
       and grantee = 'authenticated' and privilege_type = 'UPDATE'
  ) then 'sim (correto)' else 'NÃO — QUEBROU O PAINEL' end
union all
select 'lojista pode criar ou apagar loja',
  case when exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'stores'
       and grantee = 'authenticated'
       and privilege_type in ('INSERT','DELETE')
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select 'visitante consegue ler o status da assinatura',
  case when exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name = 'assinatura_status'
       and grantee = 'anon' and privilege_type = 'SELECT'
  ) then 'SIM — PROBLEMA' else 'não (correto)' end
union all
select 'lojista consegue ler as colunas novas',
  case when (
    select count(*) from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'stores'
       and column_name in ('teste_termina_em','isenta_de_mensalidade')
       and grantee = 'authenticated' and privilege_type = 'SELECT'
  ) = 2 then 'sim (correto)' else 'NÃO — A TELA VAI QUEBRAR' end
union all
select 'lojas com cortesia (as que já existiam)',
  count(*)::text from public.stores where isenta_de_mensalidade
union all
select 'lojas em teste', count(*)::text
  from public.stores where assinatura_status = 'teste';

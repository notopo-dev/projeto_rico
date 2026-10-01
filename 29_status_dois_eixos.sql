-- ============================================================
-- 29 · Separar pagamento, entrega e situação da venda
--
-- O problema: a coluna `status` guarda três coisas diferentes na
-- mesma gaveta. "pendente" significa, hoje, tanto "o cliente fechou
-- a aba e nunca pagou" quanto "o cliente reservou e vai pagar no
-- balcão" — e o lojista não tem como distinguir uma venda de verdade
-- de um carrinho abandonado.
--
-- É o mesmo desenho que Nuvemshop e Shopify usam: eixos separados,
-- porque pagar e entregar são coisas independentes. Um pedido pode
-- estar pago e não entregue, entregue e não pago (o do balcão), ou
-- cancelado em qualquer ponto.
--
--   status_pagamento   pendente · na_retirada · pago · estornado
--   status_entrega     a_separar · separando · pronto_retirada ·
--                      enviado · entregue
--   situacao           ativa · cancelada
--
-- ------------------------------------------------------------
-- Por que a coluna `status` continua existindo
-- ------------------------------------------------------------
-- Ela NÃO é removida, e passa a ser mantida por um gatilho a partir
-- dos eixos novos.
--
-- Hoje de manhã eu subi um código que lia colunas que ainda não
-- existiam e tirei a loja do ar. A lição é esta: quem lê a coluna
-- antiga — relatórios, painel, a consulta pública de pedidos, e o
-- que eu não tiver visto — continua lendo exatamente o que sempre
-- leu, sem precisar ser alterado junto. O código novo lê os eixos.
-- O antigo segue funcionando sem saber que algo mudou.
--
-- Esta migração sozinha não muda NADA na tela. Pode rodar com a loja
-- vendendo, e o site continua o mesmo até o próximo deploy.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Quanto o relatório conta HOJE (para comparar no fim)
-- ------------------------------------------------------------
select 'ANTES · o que os relatorios contam hoje' as momento,
       count(*) as pedidos,
       sum(total - valor_reembolsado) as receita
  from public.orders
 where status not in ('cancelado', 'devolvido');

-- ------------------------------------------------------------
-- 2. Colunas novas
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists status_pagamento text not null default 'pendente',
  add column if not exists status_entrega   text not null default 'a_separar',
  add column if not exists situacao         text not null default 'ativa',
  -- Marca de "não lido", no espírito de caixa de entrada: nulo = o
  -- lojista ainda não abriu este pedido. Fica fora dos status de
  -- propósito — um pedido pode ser novo E já estar pago.
  add column if not exists visto_em         timestamptz;

comment on column public.orders.status_pagamento is
  'pendente (aguardando) · na_retirada (acerta no balcao) · pago · estornado';
comment on column public.orders.status_entrega is
  'a_separar · separando · pronto_retirada · enviado · entregue';
comment on column public.orders.situacao is
  'ativa · cancelada. Separado dos outros dois porque cancelar pode acontecer em qualquer ponto.';
comment on column public.orders.visto_em is
  'Quando o lojista abriu este pedido pela primeira vez. Nulo = pedido novo, nao lido.';

-- ------------------------------------------------------------
-- 3. Traduz os pedidos que já existem
--
-- Só escreve onde ainda está no valor padrão, para a migração poder
-- rodar de novo sem desfazer o que o lojista já tiver mexido.
-- ------------------------------------------------------------
update public.orders
   set status_pagamento = case
         -- Devolvido e cancelado-com-reembolso: o dinheiro voltou.
         when status = 'devolvido' then 'estornado'
         when status = 'cancelado' and valor_reembolsado > 0 then 'estornado'
         -- Cancelado sem reembolso: nunca chegou a ser pago.
         when status = 'cancelado' then 'pendente'
         -- Enviado e entregue só acontecem depois de pago.
         when status in ('pago', 'enviado', 'entregue') then 'pago'
         else 'pendente'
       end,
       status_entrega = case
         when status = 'entregue'  then 'entregue'
         when status = 'devolvido' then 'entregue'
         when status = 'enviado'   then 'enviado'
         else 'a_separar'
       end,
       situacao = case
         when status = 'cancelado' then 'cancelada'
         else 'ativa'
       end,
       -- Pedido que já existia não é novidade para o lojista: ele já
       -- viu. Marcar todos como não lidos encheria a tela de aviso
       -- falso no primeiro acesso.
       visto_em = coalesce(visto_em, created_at)
 where status_pagamento = 'pendente'
   and status_entrega = 'a_separar'
   and situacao = 'ativa';

-- ------------------------------------------------------------
-- 4. Restrições — depois do preenchimento, nunca antes
-- ------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_pagamento_check;
alter table public.orders add  constraint orders_status_pagamento_check
  check (status_pagamento in ('pendente', 'na_retirada', 'pago', 'estornado'));

alter table public.orders drop constraint if exists orders_status_entrega_check;
alter table public.orders add  constraint orders_status_entrega_check
  check (status_entrega in ('a_separar', 'separando', 'pronto_retirada', 'enviado', 'entregue'));

alter table public.orders drop constraint if exists orders_situacao_check;
alter table public.orders add  constraint orders_situacao_check
  check (situacao in ('ativa', 'cancelada'));

-- ------------------------------------------------------------
-- 5. O gatilho que mantém a coluna antiga em dia
--
-- Esta é a peça que deixa a migração ser segura: tudo que lê
-- `status` continua certo, sem uma linha de código alterada.
--
-- A tradução é a do passo 3 ao contrário. Onde os eixos são mais
-- ricos que a coluna antiga, cai no valor antigo mais próximo:
-- "pronto_retirada" vira "enviado", porque é o estado antigo que
-- significa "saiu das mãos de quem separa" — e "na_retirada" vira
-- "pendente", porque de fato ainda não foi pago.
-- ------------------------------------------------------------
create or replace function public.sincronizar_status_legado()
returns trigger
language plpgsql
as $$
declare
  v_eixos_mudaram  boolean := false;
  v_status_mudou   boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_eixos_mudaram :=
      (new.status_pagamento, new.status_entrega, new.situacao) is distinct from
      (old.status_pagamento, old.status_entrega, old.situacao);
    v_status_mudou := new.status is distinct from old.status;
  end if;

  /*
   * O sentido de volta: alguém escreveu na coluna ANTIGA.
   *
   * O painel de hoje faz exatamente isso — `update orders set status
   * = 'pago'`. Entre esta migração e o deploy do painel novo existe
   * uma janela em que o lojista pode mudar um status por lá, e sem
   * este trecho os eixos ficariam parados, divergindo em silêncio.
   * Silêncio é o pior defeito possível num campo de dinheiro.
   *
   * Cada status antigo mexe só no eixo que lhe diz respeito, para não
   * apagar informação que a coluna antiga não sabe expressar: marcar
   * "pago" não pode zerar o fato de o pedido já estar separado.
   */
  if v_status_mudou and not v_eixos_mudaram then
    if new.status = 'cancelado' then
      new.situacao := 'cancelada';
    elsif new.status = 'devolvido' then
      new.status_pagamento := 'estornado';
      new.status_entrega   := 'entregue';
    elsif new.status = 'entregue' then
      new.status_entrega := 'entregue';
      -- Entregue em pedido de balcão significa que o dinheiro foi
      -- recebido: a loja não solta a mercadoria sem receber.
      if new.status_pagamento in ('pendente', 'na_retirada') then
        new.status_pagamento := 'pago';
      end if;
    elsif new.status = 'enviado' then
      new.status_pagamento := 'pago';
      if new.status_entrega not in ('enviado', 'pronto_retirada', 'entregue') then
        new.status_entrega := 'enviado';
      end if;
    elsif new.status = 'pago' then
      new.status_pagamento := 'pago';
    elsif new.status = 'pendente' then
      new.situacao := 'ativa';
      -- "na_retirada" é mais específico que "pendente" e sobrevive:
      -- os dois significam não pago, e o primeiro diz por quê.
      if new.status_pagamento <> 'na_retirada' then
        new.status_pagamento := 'pendente';
      end if;
    else
      /*
       * Valor que a coluna antiga não conhece.
       *
       * Sem este erro o problema sumiria: como o gatilho recalcula
       * `status` logo abaixo, a restrição CHECK nunca chegaria a ver
       * o valor errado, e a escrita viraria um silêncio — o pedido
       * ficaria parado onde estava e ninguém saberia por quê.
       */
      raise exception 'Status de pedido desconhecido: %', new.status;
    end if;
  end if;

  /*
   * O sentido principal: os eixos mandam na coluna antiga.
   *
   * Roda SEMPRE no fim, inclusive depois do trecho acima — assim a
   * coluna antiga fica normalizada mesmo quando a escrita veio por
   * ela. Tudo que lê `status` hoje continua lendo o que sempre leu.
   *
   * Onde os eixos são mais ricos que a coluna antiga, cai no valor
   * antigo mais próximo: "pronto_retirada" vira "enviado", o estado
   * que significa "saiu das mãos de quem separa", e "na_retirada"
   * vira "pendente", porque de fato ainda não foi pago.
   */
  new.status := case
    when new.situacao = 'cancelada'          then 'cancelado'
    when new.status_pagamento = 'estornado'  then 'devolvido'
    when new.status_entrega = 'entregue'     then 'entregue'
    when new.status_entrega in ('enviado', 'pronto_retirada') then 'enviado'
    when new.status_pagamento = 'pago'       then 'pago'
    else 'pendente'
  end;

  -- updated_at tinha padrão mas nada o atualizava: ficava parado na
  -- data de criação para sempre. Já que há um gatilho aqui, ele passa
  -- a valer para alguma coisa.
  new.updated_at := now();

  return new;
end $$;

drop trigger if exists trg_sincronizar_status_legado on public.orders;
create trigger trg_sincronizar_status_legado
  before insert or update on public.orders
  for each row
  execute function public.sincronizar_status_legado();

-- ------------------------------------------------------------
-- 6. Índices
--
-- O painel vai filtrar por estes campos o tempo todo, e contar os
-- não lidos em toda abertura de tela.
-- ------------------------------------------------------------
create index if not exists idx_orders_loja_entrega
  on public.orders (store_id, status_entrega);
create index if not exists idx_orders_loja_pagamento
  on public.orders (store_id, status_pagamento);
create index if not exists idx_orders_nao_lidos
  on public.orders (store_id) where visto_em is null;

-- ------------------------------------------------------------
-- 7. Conferência
--
-- Esperado:
--   · nenhuma linha em "INCOERENTE" — se aparecer alguma, o gatilho
--     e o preenchimento discordam, e aí não siga adiante
--   · a contagem por eixo batendo com o que você espera
-- ------------------------------------------------------------
select 'INCOERENTE · gatilho discorda do preenchimento' as problema,
       numero, status, status_pagamento, status_entrega, situacao
  from public.orders
 where status <> case
         when situacao = 'cancelada'         then 'cancelado'
         when status_pagamento = 'estornado' then 'devolvido'
         when status_entrega = 'entregue'    then 'entregue'
         when status_entrega in ('enviado', 'pronto_retirada') then 'enviado'
         when status_pagamento = 'pago'      then 'pago'
         else 'pendente'
       end;

select 'DEPOIS · como ficaram os pedidos' as momento,
       situacao, status_pagamento, status_entrega,
       count(*) as pedidos,
       sum(total - valor_reembolsado) as valor
  from public.orders
 group by situacao, status_pagamento, status_entrega
 order by count(*) desc;

-- O número que vai mudar no seu relatório, quando o código novo
-- subir: hoje conta tudo que não é cancelado nem devolvido; passará a
-- contar só o que foi pago de verdade.
select 'RECEITA · antes e depois' as comparacao,
       sum(total - valor_reembolsado) filter (where status not in ('cancelado','devolvido')) as conta_hoje,
       sum(total - valor_reembolsado) filter (where status_pagamento = 'pago')               as vai_contar,
       count(*) filter (where status_pagamento = 'pendente' and situacao = 'ativa'
                          and created_at < now() - interval '1 day')                         as abandonados_que_saem
  from public.orders;

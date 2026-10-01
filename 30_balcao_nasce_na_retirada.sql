-- ============================================================
-- 30 · O pedido de balcão nasce como "paga ao retirar"
--
-- Falha minha na 29: criei o eixo com o valor "na_retirada", mas nada
-- o preenchia. O pedido pago no balcão continuava nascendo
-- "pendente" — misturado com o carrinho abandonado, que é
-- exatamente o problema que esta série de migrações veio resolver.
--
-- ------------------------------------------------------------
-- Por que no gatilho, e não na função que cria o pedido
-- ------------------------------------------------------------
-- A regra é: se o pagamento é no balcão, o pedido está reservado,
-- não abandonado. Isso vale para QUALQUER pedido com esse método,
-- não só para os que passam pela função de checkout — um importado,
-- um criado à mão no painel, um que venha de uma integração futura.
--
-- No gatilho, a regra vale uma vez só e para todos os caminhos. Na
-- função, valeria para um caminho e teria de ser lembrada em cada
-- novo — e seria esquecida, como foi agora.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

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
   * Pedido novo pago no balcão: nasce reservado, não "aguardando".
   *
   * Só na criação, e só se ninguém disse nada: quem passa um valor
   * explícito manda, e um pedido que já foi pago no balcão não volta
   * a ser "a pagar" porque alguém mexeu em outro campo.
   */
  if tg_op = 'INSERT'
     and new.metodo_pagamento in ('dinheiro', 'maquininha')
     and new.status_pagamento = 'pendente' then
    new.status_pagamento := 'na_retirada';
  end if;

  /*
   * O sentido de volta: alguém escreveu na coluna ANTIGA.
   *
   * O painel antigo faz isso — `update orders set status = 'pago'`.
   * Sem este trecho, uma mudança por lá deixaria os eixos parados,
   * divergindo em silêncio. Silêncio é o pior defeito possível num
   * campo de dinheiro.
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
   */
  new.status := case
    when new.situacao = 'cancelada'          then 'cancelado'
    when new.status_pagamento = 'estornado'  then 'devolvido'
    when new.status_entrega = 'entregue'     then 'entregue'
    when new.status_entrega in ('enviado', 'pronto_retirada') then 'enviado'
    when new.status_pagamento = 'pago'       then 'pago'
    else 'pendente'
  end;

  new.updated_at := now();

  return new;
end $$;

-- ------------------------------------------------------------
-- Conserta os pedidos de balcão que já nasceram errados
--
-- Só os que ainda não foram pagos nem cancelados: um que já foi
-- recebido no balcão está "pago" e deve continuar assim.
-- ------------------------------------------------------------
update public.orders
   set status_pagamento = 'na_retirada'
 where metodo_pagamento in ('dinheiro', 'maquininha')
   and status_pagamento = 'pendente'
   and situacao = 'ativa';

-- ------------------------------------------------------------
-- Conferência
--
-- Esperado: todo pedido de balcão ativo e não pago aparece como
-- "na_retirada". Se algum aparecer como "pendente", ele ainda está
-- se passando por carrinho abandonado.
-- ------------------------------------------------------------
select 'pedidos de balcao' as conferencia,
       metodo_pagamento,
       status_pagamento,
       situacao,
       count(*) as pedidos
  from public.orders
 where metodo_pagamento in ('dinheiro', 'maquininha')
 group by metodo_pagamento, status_pagamento, situacao
 order by metodo_pagamento, status_pagamento;

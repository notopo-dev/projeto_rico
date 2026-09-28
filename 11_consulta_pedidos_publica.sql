-- =====================================================================
-- Consulta pública de pedidos, por CPF + telefone
-- LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. Idempotente.
--
-- O QUE ESTAVA QUEBRADO
-- A versão anterior achava o cliente com `limit 1` e olhava os pedidos
-- só daquele. Com o cadastro duplicado (o checkout criava um cliente
-- novo quando o CPF não batia), havia DOIS registros da mesma pessoa:
-- um com os pedidos, outro vazio. Sem ORDER BY, o `limit 1` pegava
-- qualquer um — e quando pegava o vazio, o cliente digitava CPF e
-- telefone certos e ouvia "nenhum pedido encontrado".
--
-- Agora a função junta os pedidos de TODOS os cadastros que batem.
-- Some o problema mesmo que a duplicata volte a acontecer por outro
-- motivo.
--
-- O QUE MUDOU ALÉM DISSO
-- Passa a devolver o id do pedido (para o botão de rastrear), o código
-- de rastreio, a transportadora, o prazo e quanto foi devolvido.
--
-- SEGURANÇA — inalterada
-- Continua exigindo CPF **e** telefone batendo. Só o CPF não basta:
-- senão daria para descobrir pedido de terceiro tentando CPFs. E a
-- função nunca diz se o CPF existe — CPF errado e cliente sem pedido
-- devolvem a mesma coisa: vazio.
-- =====================================================================

drop function if exists consultar_pedidos_publico(uuid, text, text);

create or replace function consultar_pedidos_publico(
  p_store_id uuid,
  p_cpf text,
  p_telefone text
)
returns table (
  id uuid,
  numero text,
  status text,
  metodo_pagamento text,
  subtotal numeric,
  frete numeric,
  total numeric,
  valor_reembolsado numeric,
  criado_em timestamptz,
  codigo_rastreio text,
  frete_transportadora text,
  frete_prazo_dias integer,
  itens jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  -- Sem os dois, nem consulta. Evita que uma chamada com campo vazio
  -- case com cadastro que também tenha o campo vazio.
  if length(v_cpf) < 11 or length(v_tel) < 10 then
    return;
  end if;

  return query
  select
    o.id,
    o.numero,
    o.status,
    o.metodo_pagamento,
    o.subtotal,
    o.frete,
    o.total,
    coalesce(o.valor_reembolsado, 0),
    o.created_at,
    o.codigo_rastreio,
    o.frete_transportadora,
    o.frete_prazo_dias,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'nome_produto', oi.nome_produto,
            'quantidade', oi.quantidade,
            'preco_unitario', oi.preco_unitario,
            'subtotal', oi.subtotal,
            'cor_selecionada', oi.cor_selecionada,
            'tamanho_selecionado', oi.tamanho_selecionado
          )
        )
        from order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    ) as itens
  from orders o
  -- TODOS os cadastros que batem, não só o primeiro. É isto que
  -- conserta o caso do cliente duplicado.
  where o.store_id = p_store_id
    and o.customer_id in (
      select c.id
      from customers c
      where c.store_id = p_store_id
        and c.cpf is not null
        and c.telefone is not null
        and regexp_replace(c.cpf, '\D', '', 'g') = v_cpf
        and regexp_replace(c.telefone, '\D', '', 'g') = v_tel
    )
  order by o.created_at desc;
end;
$$;

-- Qualquer visitante pode chamar: a própria função protege o acesso,
-- então não é preciso abrir SELECT em orders nem em customers.
revoke all on function consultar_pedidos_publico(uuid, text, text) from public;
grant execute on function consultar_pedidos_publico(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Conferência: troque pelos dados de um cliente real e veja se volta
-- ---------------------------------------------------------------------
-- select numero, status, codigo_rastreio
-- from consultar_pedidos_publico(
--   '80daad15-800a-4b98-82c9-6a63a7034b89',
--   '00000000000',
--   '77900000000'
-- );

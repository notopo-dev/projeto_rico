-- =====================================================================
-- A identidade da compra fica no PEDIDO, não no cadastro
-- LojaPro / Money NoTopo
--
-- Rode este arquivo INTEIRO no SQL Editor do Supabase. Idempotente.
--
-- O PROBLEMA QUE ISTO RESOLVE
-- A consulta "Meus pedidos" comparava o CPF e o telefone digitados
-- contra a tabela CUSTOMERS. Só que o cadastro é mutável e pode estar
-- incompleto: o cliente com 17 pedidos estava com o CPF em branco,
-- porque o cadastro nasceu antes de a loja pedir CPF. Ele digitava os
-- dados certos e ouvia "nenhum pedido encontrado".
--
-- A saída óbvia seria o checkout completar o cadastro. Mas o checkout
-- roda no navegador de quem está comprando, sem login: se ele pudesse
-- gravar um CPF num cadastro existente, bastaria saber o telefone de
-- alguém para carimbar o próprio CPF ali e, com os dois, ler o
-- histórico inteiro da vítima.
--
-- A correção é outra: cada pedido passa a guardar o CPF e o telefone
-- usados NAQUELA compra. A prova de identidade pertence ao pedido, não
-- ao cadastro.
--
-- Com isso, quem fizer uma compra informando o telefone de outra
-- pessoa e o próprio CPF só enxerga o PRÓPRIO pedido — o histórico
-- alheio continua fora de alcance. E o dado é gravado sempre, sem
-- depender de o cadastro estar completo.
-- =====================================================================

alter table public.orders
  add column if not exists cpf_comprador      text,
  add column if not exists telefone_comprador text;

comment on column public.orders.cpf_comprador is
  'CPF informado NESTA compra, só dígitos. É a prova de identidade para consultar o pedido.';
comment on column public.orders.telefone_comprador is
  'Telefone informado NESTA compra, só dígitos.';

create index if not exists idx_orders_identidade_compra
  on public.orders (store_id, cpf_comprador, telefone_comprador)
  where cpf_comprador is not null;

-- ---------------------------------------------------------------------
-- Pedidos antigos: herdam o que houver no cadastro.
--
-- Onde o cadastro estiver incompleto, o pedido continua sem a
-- identidade — e é por isso que a função abaixo mantém a busca pelo
-- cadastro como segunda tentativa. Assim, completar o CPF pelo painel
-- conserta todos os pedidos antigos daquele cliente de uma vez.
-- ---------------------------------------------------------------------
update public.orders o
set
  cpf_comprador = coalesce(
    o.cpf_comprador,
    regexp_replace(c.cpf, '\D', '', 'g')
  ),
  telefone_comprador = coalesce(
    o.telefone_comprador,
    regexp_replace(c.telefone, '\D', '', 'g')
  )
from public.customers c
where c.id = o.customer_id
  and (o.cpf_comprador is null or o.telefone_comprador is null)
  and (c.cpf is not null or c.telefone is not null);

-- =====================================================================
-- A consulta pública, agora olhando o pedido primeiro
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
  -- Sem os dois, nem consulta. Impede que uma chamada com campo vazio
  -- case com registro que também tenha o campo vazio.
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
    -- orders.created_at está gravado SEM fuso e o retorno é declarado
    -- COM fuso; o Postgres recusa a diferença. Converter para neutro e
    -- então dizer "isto é UTC" acerta nos dois casos, sem deslocar
    -- nada. Importa porque o navegador faz `new Date(...)`: sem o fuso
    -- na string, ele assumiria o horário local de quem está olhando.
    (o.created_at::timestamp at time zone 'UTC'),
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
  where o.store_id = p_store_id
    and (
      -- 1ª tentativa: a identidade gravada NO PEDIDO.
      (
        regexp_replace(coalesce(o.cpf_comprador, ''), '\D', '', 'g') = v_cpf
        and regexp_replace(coalesce(o.telefone_comprador, ''), '\D', '', 'g') = v_tel
      )
      -- 2ª tentativa: o cadastro do cliente, para pedidos antigos que
      -- ainda não têm a identidade própria. Pega TODOS os cadastros que
      -- batem, e não só o primeiro — era o `limit 1` que fazia o
      -- cliente duplicado sumir da consulta.
      or o.customer_id in (
        select c.id
        from customers c
        where c.store_id = p_store_id
          and c.cpf is not null
          and c.telefone is not null
          and regexp_replace(c.cpf, '\D', '', 'g') = v_cpf
          and regexp_replace(c.telefone, '\D', '', 'g') = v_tel
      )
    )
  order by o.created_at desc;
end;
$$;

revoke all on function consultar_pedidos_publico(uuid, text, text) from public;
grant execute on function consultar_pedidos_publico(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Conferência: quantos pedidos já têm identidade própria
-- ---------------------------------------------------------------------
select
  count(*) filter (where cpf_comprador is not null)  as com_cpf,
  count(*) filter (where cpf_comprador is null)      as sem_cpf,
  count(*)                                           as total
from public.orders;

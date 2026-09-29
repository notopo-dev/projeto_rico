-- ============================================================
-- 19_checkout_seguro.sql
--
-- Refaz o checkout público. Dois problemas, e o segundo é pior:
--
-- 1. O PEDIDO NÃO ERA CRIADO NO CELULAR DE NINGUÉM.
--    Só funcionava na máquina do lojista, porque ali existia login e
--    a política de dono deixava passar. Para um visitante de verdade,
--    o insert em orders batia no RLS e a compra morria ali.
--
-- 2. O PREÇO VINHA DO NAVEGADOR.
--    O checkout mandava `preco_unitario` junto com o pedido, e o
--    servidor aceitava. Quem soubesse mexer na requisição comprava
--    qualquer coisa por um centavo — e a cobrança na Stripe sai do
--    total do pedido, ou seja, do valor adulterado. Isso estava no ar.
--
-- A correção resolve os dois de uma vez: o pedido passa a ser criado
-- por esta função, que roda com os poderes do DONO do banco. O
-- navegador deixa de precisar de qualquer permissão de escrita, e o
-- PREÇO É LIDO AQUI, da tabela de produtos. O que o navegador manda
-- sobre valores é ignorado.
--
-- De quebra, isto fecha um vazamento: existia uma política que
-- liberava LER a tabela de clientes para qualquer visitante de
-- qualquer loja ativa — nome, e-mail, telefone e CPF de todo mundo,
-- a partir de qualquer navegador. Ela é removida aqui.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A função
-- ------------------------------------------------------------
create or replace function public.criar_pedido_publico(
  p_store_id  uuid,
  p_cliente   jsonb,   -- {nome, telefone, cpf, email}
  p_itens     jsonb,   -- [{product_id, quantidade, cor, tamanho}]
  p_metodo    text,    -- pix | cartao_credito | cartao_debito | null
  p_endereco  jsonb,   -- null quando é retirada na loja
  p_frete     jsonb    -- {servicoId, nome, transportadora, preco, prazoDias} ou null
)
returns table (id uuid, numero text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja        record;
  v_item        jsonb;
  v_produto     record;
  v_qtd         integer;
  v_preco       numeric(10,2);
  v_subtotal    numeric(10,2) := 0;
  v_frete       numeric(10,2) := 0;
  v_gratis      boolean := false;
  v_cliente_id  uuid;
  v_cpf         text;
  v_telefone    text;
  v_email       text;
  v_nome        text;
  v_pedido_id   uuid;
  v_numero      text;
  v_servico     text;
begin
  -- Loja precisa existir e estar ativa
  select s.id, s.ativo, s.frete_modo, s.frete_fixo, s.frete_gratis_acima,
         s.retirada_na_loja
    into v_loja
    from public.stores s
   where s.id = p_store_id;

  if v_loja is null or not v_loja.ativo then
    raise exception 'Loja indisponível no momento.';
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'Seu carrinho está vazio.';
  end if;

  -- ----------------------------------------------------------
  -- Identidade de quem está comprando
  -- ----------------------------------------------------------
  v_nome     := nullif(btrim(coalesce(p_cliente->>'nome', '')), '');
  v_cpf      := nullif(regexp_replace(coalesce(p_cliente->>'cpf', ''), '\D', '', 'g'), '');
  v_telefone := nullif(regexp_replace(coalesce(p_cliente->>'telefone', ''), '\D', '', 'g'), '');
  v_email    := nullif(lower(btrim(coalesce(p_cliente->>'email', ''))), '');

  if v_nome is null then
    raise exception 'Informe seu nome.';
  end if;
  if v_cpf is null or length(v_cpf) <> 11 then
    raise exception 'Informe um CPF válido.';
  end if;
  if v_telefone is null or length(v_telefone) < 10 then
    raise exception 'Informe um telefone válido com DDD.';
  end if;

  -- ----------------------------------------------------------
  -- Preço: lido DAQUI, nunca do que o navegador mandou
  -- ----------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := greatest(coalesce((v_item->>'quantidade')::integer, 0), 0);
    if v_qtd = 0 then
      raise exception 'Quantidade inválida.';
    end if;

    select p.id, p.nome, p.preco, p.preco_promocional, p.estoque,
           p.permite_venda_sem_estoque, p.status
      into v_produto
      from public.products p
     where p.id = (v_item->>'product_id')::uuid
       and p.store_id = p_store_id;

    if v_produto is null then
      raise exception 'Produto fora do catálogo desta loja.';
    end if;
    if v_produto.status = 'inativo' then
      raise exception 'O produto % não está mais à venda.', v_produto.nome;
    end if;
    -- Impede vender o que acabou entre abrir a página e finalizar
    if v_produto.estoque < v_qtd and not v_produto.permite_venda_sem_estoque then
      raise exception 'Estoque insuficiente para %.', v_produto.nome;
    end if;

    v_subtotal := v_subtotal
      + coalesce(v_produto.preco_promocional, v_produto.preco) * v_qtd;
  end loop;

  -- ----------------------------------------------------------
  -- Frete: as regras da loja mandam, não o navegador
  -- ----------------------------------------------------------
  v_gratis := v_loja.frete_gratis_acima is not null
              and v_subtotal >= v_loja.frete_gratis_acima;

  if p_endereco is null then
    -- Retirada no balcão
    if not v_loja.retirada_na_loja then
      raise exception 'Esta loja não oferece retirada.';
    end if;
    v_frete := 0;
  elsif v_gratis then
    v_frete := 0;
  elsif v_loja.frete_modo = 'fixo' then
    v_frete := coalesce(v_loja.frete_fixo, 0);
  elsif v_loja.frete_modo = 'melhor_envio' then
    -- Único caso em que o valor vem de fora: é a cotação da
    -- transportadora, que o banco não tem como refazer. Fica limitado
    -- a um número não negativo, e mexer nele só prejudica o próprio
    -- comprador ou custa o frete ao lojista — nunca o produto.
    v_frete := greatest(coalesce((p_frete->>'preco')::numeric, 0), 0);
  else
    v_frete := 0; -- combinar depois
  end if;

  -- ----------------------------------------------------------
  -- Cliente: acha ou cria. Nunca sobrescreve cadastro existente —
  -- quem corrige cadastro é o lojista, no painel.
  -- ----------------------------------------------------------
  select c.id into v_cliente_id
    from public.customers c
   where c.store_id = p_store_id and c.cpf = v_cpf
   limit 1;

  if v_cliente_id is null then
    select c.id into v_cliente_id
      from public.customers c
     where c.store_id = p_store_id and c.telefone = v_telefone
     limit 1;
  end if;

  if v_cliente_id is null and v_email is not null then
    select c.id into v_cliente_id
      from public.customers c
     where c.store_id = p_store_id and c.email = v_email
     limit 1;
  end if;

  if v_cliente_id is null then
    insert into public.customers (store_id, nome, telefone, cpf, email)
    values (p_store_id, v_nome, v_telefone, v_cpf, v_email)
    returning customers.id into v_cliente_id;
  end if;

  -- ----------------------------------------------------------
  -- Pedido
  -- ----------------------------------------------------------
  v_servico := nullif(p_frete->>'servicoId', '');

  insert into public.orders (
    store_id, customer_id, status,
    cpf_comprador, telefone_comprador,
    metodo_pagamento, subtotal, frete, total,
    endereco_entrega, cep_entrega,
    frete_servico, frete_transportadora, frete_prazo_dias
  )
  values (
    p_store_id, v_cliente_id, 'pendente',
    v_cpf, v_telefone,
    p_metodo, v_subtotal, v_frete, v_subtotal + v_frete,
    p_endereco,
    nullif(regexp_replace(coalesce(p_endereco->>'cep', ''), '\D', '', 'g'), ''),
    v_servico,
    nullif(btrim(concat_ws(' ', p_frete->>'transportadora', p_frete->>'nome')), ''),
    (p_frete->>'prazoDias')::integer
  )
  returning orders.id, orders.numero into v_pedido_id, v_numero;

  -- ----------------------------------------------------------
  -- Itens, com o preço do servidor
  -- ----------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_qtd := (v_item->>'quantidade')::integer;

    select coalesce(p.preco_promocional, p.preco), p.nome
      into v_preco, v_nome
      from public.products p
     where p.id = (v_item->>'product_id')::uuid
       and p.store_id = p_store_id;

    insert into public.order_items (
      order_id, product_id, nome_produto, quantidade,
      preco_unitario, subtotal, cor_selecionada, tamanho_selecionado
    )
    values (
      v_pedido_id, (v_item->>'product_id')::uuid, v_nome, v_qtd,
      v_preco, v_preco * v_qtd,
      nullif(v_item->>'cor', ''), nullif(v_item->>'tamanho', '')
    );
  end loop;

  -- Devolve o total CALCULADO AQUI. É com ele que a tela de
  -- pagamento fala, e não com a soma que o navegador tinha — se um
  -- preço mudou no meio da compra, o cliente vê o valor real antes de
  -- pagar.
  return query select v_pedido_id, v_numero, (v_subtotal + v_frete)::numeric;
end;
$$;

revoke all on function public.criar_pedido_publico(uuid, jsonb, jsonb, text, jsonb, jsonb) from public;
grant execute on function public.criar_pedido_publico(uuid, jsonb, jsonb, text, jsonb, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Fecha o que estava aberto
--
-- Com a função acima, o navegador não precisa mais escrever em tabela
-- nenhuma. Cada política removida aqui é uma porta que deixa de
-- existir.
--
-- A de LER clientes era a mais séria: liberava nome, e-mail, telefone
-- e CPF de todos os clientes de todas as lojas ativas para qualquer
-- pessoa com o endereço da loja aberto.
-- ------------------------------------------------------------
drop policy if exists "public_select_customers_for_checkout" on public.customers;
drop policy if exists "public_insert_customers"              on public.customers;
drop policy if exists "public_insert_orders"                 on public.orders;
drop policy if exists "public_insert_order_items"            on public.order_items;

-- ------------------------------------------------------------
-- 3. Conferência: nada de anon escrevendo ou lendo cliente/pedido
-- ------------------------------------------------------------
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('customers', 'orders', 'order_items')
 order by tablename, policyname;

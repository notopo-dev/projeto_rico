-- ============================================================
-- 27 · Pagar na retirada: dinheiro e maquininha
--
-- O que entra:
--   stores.retirada_aceita_dinheiro     — a loja recebe em espécie
--   stores.retirada_aceita_maquininha   — a loja passa na maquininha
--   orders.troco_para                   — "preciso de troco para R$ X"
--
-- Os dois interruptores nascem DESLIGADOS. Loja nenhuma passa a
-- oferecer pagamento no balcão porque esta migração rodou.
--
-- ------------------------------------------------------------
-- E um buraco que já existia
-- ------------------------------------------------------------
-- criar_pedido_publico grava p_metodo direto no pedido, sem conferir
-- nada. O comentário dela diz "pix | cartao_credito | cartao_debito",
-- mas isso é só comentário: qualquer texto passa.
--
-- Até hoje isso custava pouco, porque todo método levava à cobrança
-- online, que confere de novo antes de aceitar dinheiro. "Pagar na
-- retirada" muda isso: é o primeiro método que fecha o pedido SEM
-- passar por cobrança. Sem conferência, bastaria uma requisição à mão
-- com metodo = 'dinheiro' para fechar pedido em qualquer loja — até
-- nas que não oferecem retirada.
--
-- Por isso a função passa a conferir o método contra o que a loja de
-- fato aceita. A tela já esconde o que a loja não oferece; isto é a
-- tranca, para quem não usa a tela.
--
-- Rodar no SQL Editor. Pode rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colunas
-- ------------------------------------------------------------
alter table public.stores
  add column if not exists retirada_aceita_dinheiro   boolean not null default false,
  add column if not exists retirada_aceita_maquininha boolean not null default false;

comment on column public.stores.retirada_aceita_dinheiro is
  'A loja recebe em dinheiro no balcão, na hora da retirada.';
comment on column public.stores.retirada_aceita_maquininha is
  'A loja passa o cartão na própria maquininha, na hora da retirada.';

alter table public.orders
  add column if not exists troco_para numeric(10,2);

comment on column public.orders.troco_para is
  'Quanto o cliente vai entregar em dinheiro, para a loja separar o troco. Só em pedido com metodo_pagamento = dinheiro.';

-- ------------------------------------------------------------
-- 2. A função, agora com conferência de método e troco
--
-- A assinatura muda (entra p_troco_para), então a antiga precisa sair
-- antes: `create or replace` não troca assinatura, ele criaria uma
-- SEGUNDA função — e aí o PostgREST não saberia qual chamar.
-- ------------------------------------------------------------
drop function if exists public.criar_pedido_publico(uuid, jsonb, jsonb, text, jsonb, jsonb);

create or replace function public.criar_pedido_publico(
  p_store_id   uuid,
  p_cliente    jsonb,   -- {nome, telefone, cpf, email}
  p_itens      jsonb,   -- [{product_id, quantidade, cor, tamanho}]
  p_metodo     text,    -- pix | cartao_credito | cartao_debito | dinheiro | maquininha | null
  p_endereco   jsonb,   -- null quando é retirada na loja
  p_frete      jsonb,   -- {servicoId, nome, transportadora, preco, prazoDias} ou null
  p_troco_para numeric default null  -- só vale com metodo = dinheiro
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
  v_metodo      text;
  v_retirada    boolean;
  v_modo        text;
  v_troco       numeric(10,2) := null;
  v_total       numeric(10,2);
begin
  -- Loja precisa existir e estar ativa
  select s.id, s.ativo, s.frete_modo, s.frete_fixo, s.frete_gratis_acima,
         s.retirada_na_loja, s.modo_compra, s.aceita_pix, s.aceita_cartao,
         s.retirada_aceita_dinheiro, s.retirada_aceita_maquininha
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
  -- Método de pagamento: a loja decide, não o navegador
  --
  -- modo_compra nulo é tratado como 'ambos' de propósito. A coluna é
  -- antiga e pode estar vazia em loja que já vende; recusar por causa
  -- dela tiraria do ar quem está funcionando hoje. O que de fato
  -- tranca cada caminho são as colunas específicas logo abaixo
  -- (aceita_pix, aceita_cartao, retirada_aceita_*), e essas têm valor
  -- em toda loja.
  -- ----------------------------------------------------------
  v_metodo   := nullif(btrim(lower(coalesce(p_metodo, ''))), '');
  v_retirada := p_endereco is null;
  v_modo     := coalesce(v_loja.modo_compra, 'ambos');

  -- Os nomes abaixo são os que o checkout de fato envia, e não os
  -- que a tela mostra: lá dentro, "credito" vira "cartao_credito"
  -- antes de sair (METODO_NO_BANCO, em StoreCheckout.tsx), e o
  -- WhatsApp vira NULO, porque nele não houve escolha de pagamento
  -- nenhuma — fica para a conversa.
  if v_metodo is not null then
    if v_metodo = 'pix' then
      if v_modo not in ('pagamento', 'ambos')
         or not coalesce(v_loja.aceita_pix, false) then
        raise exception 'Esta loja não aceita Pix no momento.';
      end if;

    elsif v_metodo in ('cartao_credito', 'cartao_debito') then
      if v_modo not in ('pagamento', 'ambos')
         or not coalesce(v_loja.aceita_cartao, true) then
        raise exception 'Esta loja não aceita cartão no momento.';
      end if;

    elsif v_metodo in ('dinheiro', 'maquininha') then
      -- Pagar na hora só existe para quem vai buscar no balcão. Com
      -- entrega, ninguém da loja está presente para receber.
      if not v_retirada then
        raise exception 'Pagamento no balcão só vale para retirada na loja.';
      end if;
      if not v_loja.retirada_na_loja then
        raise exception 'Esta loja não oferece retirada.';
      end if;
      if v_metodo = 'dinheiro'
         and not coalesce(v_loja.retirada_aceita_dinheiro, false) then
        raise exception 'Esta loja não recebe em dinheiro na retirada.';
      end if;
      if v_metodo = 'maquininha'
         and not coalesce(v_loja.retirada_aceita_maquininha, false) then
        raise exception 'Esta loja não passa cartão na retirada.';
      end if;

    else
      raise exception 'Forma de pagamento inválida.';
    end if;
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

  if v_retirada then
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

  v_total := v_subtotal + v_frete;

  -- ----------------------------------------------------------
  -- Troco
  --
  -- Só faz sentido com dinheiro, e só serve para a loja saber quanto
  -- separar. Valor menor que o total seria um pedido impossível de
  -- atender, então é recusado aqui em vez de virar discussão no
  -- balcão. Em qualquer outro método o campo é descartado, para não
  -- sobrar sujeira no pedido.
  -- ----------------------------------------------------------
  if v_metodo = 'dinheiro' and p_troco_para is not null then
    if p_troco_para < v_total then
      raise exception 'O valor para troco precisa ser pelo menos o total do pedido.';
    end if;
    v_troco := round(p_troco_para, 2);
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
    metodo_pagamento, troco_para, subtotal, frete, total,
    endereco_entrega, cep_entrega,
    frete_servico, frete_transportadora, frete_prazo_dias
  )
  values (
    p_store_id, v_cliente_id, 'pendente',
    v_cpf, v_telefone,
    v_metodo, v_troco, v_subtotal, v_frete, v_total,
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
  return query select v_pedido_id, v_numero, v_total::numeric;
end;
$$;

revoke all on function public.criar_pedido_publico(uuid, jsonb, jsonb, text, jsonb, jsonb, numeric) from public;
grant execute on function public.criar_pedido_publico(uuid, jsonb, jsonb, text, jsonb, jsonb, numeric) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Conferência
--
-- Esperado:
--   · uma linha em "colunas novas" para cada uma das três
--   · UMA só função criar_pedido_publico, com 7 argumentos
--     (duas linhas aqui significam que a antiga não saiu — e aí o
--      PostgREST escolhe sozinho qual chamar)
-- ------------------------------------------------------------
select 'colunas novas' as conferencia, table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and (
     (table_name = 'stores' and column_name in
       ('retirada_aceita_dinheiro', 'retirada_aceita_maquininha'))
     or (table_name = 'orders' and column_name = 'troco_para')
   )
 order by table_name, column_name;

select 'funcao' as conferencia,
       p.proname,
       pg_get_function_identity_arguments(p.oid) as argumentos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'criar_pedido_publico';

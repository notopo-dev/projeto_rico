import { supabase } from "../../lib/supabaseClient";

export interface PublicStore {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  logo_url: string | null;
  banner_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  whatsapp: string | null;
  email: string | null;
  politica_troca: string | null;
  politica_frete: string | null;
  modo_compra: "whatsapp" | "pagamento" | "ambos";
  ativo: boolean;
}

export interface PublicCategory {
  id: string;
  nome: string;
  slug: string;
}

export interface PublicProductImage {
  url: string;
  posicao: number;
}
export interface PublicProductColor {
  id?: string;
  nome: string;
  codigo_hex?: string | null;
  imagem_url?: string | null;
}

export interface PublicProduct {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  sku: string;
  preco: number;
  preco_promocional: number | null;
  estoque: number;
  permite_venda_sem_estoque: boolean;
  category_id: string | null;
  categoria_nome: string | null;
  imagens: PublicProductImage[];
  cores: PublicProductColor[];
  tamanhos: {id?: string; tamanho:string}[];
  item_promocao: boolean;
}

/**
 * Busca os dados públicos de uma loja pelo slug.
 * Retorna null se não existir ou não estiver ativa.
 */
export async function getStoreBySlug(slug: string): Promise<PublicStore | null> {
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, nome, slug, descricao, logo_url, banner_url, cor_primaria, cor_secundaria, whatsapp, email, politica_troca, politica_frete, modo_compra, ativo"
    )
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPublicCategories(
  storeId: string
): Promise<PublicCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, nome, slug")
    .eq("store_id", storeId)
    .eq("ativa", true)
    .order("nome");

  if (error) throw error;
  return data ?? [];
}

/**
 * Lista produtos visíveis na loja pública: ativos, e com estoque
 * OU com venda liberada mesmo sem estoque.
 */
export async function listPublicProducts(
  storeId: string
): Promise<PublicProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, nome, slug, descricao, sku, preco, preco_promocional, estoque, permite_venda_sem_estoque, category_id, categories(nome), product_images(url, posicao), product_colors(id,nome,codigo_hex,imagem_url), product_sizes(id,tamanho), item_promocao"
    )
    .eq("store_id", storeId)
    .eq("status", "ativo")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    ...p,
    categoria_nome: p.categories?.nome ?? null,
    imagens: (p.product_images ?? []).sort(
      (a: any, b: any) => a.posicao - b.posicao
    ),
    cores: p.product_colors ?? [],
    tamanhos: p.product_sizes ?? [],
    item_promocao: p.item_promocao ?? false,
  }));
}

export async function getPublicProductBySlug(
  storeId: string,
  productSlug: string
): Promise<PublicProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, nome, slug, descricao, sku, preco, preco_promocional, estoque, permite_venda_sem_estoque, category_id, categories(nome), product_images(url, posicao), product_colors(id,nome,codigo_hex,imagem_url), product_sizes(id,tamanho), item_promocao"
    )
    .eq("store_id", storeId)
    .eq("slug", productSlug)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p: any = data;
  return {
    ...p,
    categoria_nome: p.categories?.nome ?? null,
    imagens: (p.product_images ?? []).sort(
      (a: any, b: any) => a.posicao - b.posicao
    ),
    cores: p.product_colors ?? [],
    tamanhos: p.product_sizes ?? [],
    item_promocao: p.item_promocao ?? false,
  };
}

export interface CartItemInput {
  product_id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  cor_selecionada?: string;
  tamanho_selecionado?: string;
}

export interface CheckoutInput {
  storeId: string;
  itens: CartItemInput[];
  metodoPagamento: "pix" | "cartao" | null;
  cliente: {
    nome: string;
    telefone: string;
    cpf: string;
    email?: string;
  };
  enderecoEntrega?: Record<string, unknown>;
}

/**
 * Cria o pedido no banco (cliente + pedido + itens).
 * Usado tanto para o fluxo de WhatsApp (registra o pedido antes
 * de redirecionar) quanto para o fluxo de pagamento.
 */
export async function createPublicOrder(input: CheckoutInput) {
  // 1. Garante o cliente (busca por CPF+telefone; cria se não
  // existir). CPF é necessário para a consulta pública de
  // pedidos funcionar depois.
  let customerId: string | null = null;

  const cpfDigits = input.cliente.cpf.replace(/\D/g, "");
  const telefoneDigits = input.cliente.telefone.replace(/\D/g, "");

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("cpf", cpfDigits)
    .eq("telefone", telefoneDigits)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
  }

  if (!customerId) {
    const { data: created, error: customerError } = await supabase
      .from("customers")
      .insert({
        store_id: input.storeId,
        nome: input.cliente.nome,
        telefone: telefoneDigits,
        cpf: cpfDigits,
        email: input.cliente.email || null,
      })
      .select("id")
      .single();

    if (customerError) throw customerError;
    customerId = created.id;
  }

  // 2. Cria o pedido
  const subtotal = input.itens.reduce(
    (sum, item) => sum + item.preco_unitario * item.quantidade,
    0
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: input.storeId,
      customer_id: customerId,
      status: "pendente",
      metodo_pagamento: input.metodoPagamento,
      subtotal,
      frete: 0,
      total: subtotal,
      endereco_entrega: input.enderecoEntrega ?? null,
    })
    .select("id, numero")
    .single();

  if (orderError) throw orderError;

  // 3. Cria os itens do pedido — inclui cor/tamanho escolhidos,
  // para não perder essa informação entre carrinho e pedido final.
  const itemsPayload = input.itens.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    nome_produto: item.nome_produto,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    subtotal: item.preco_unitario * item.quantidade,
    cor_selecionada: item.cor_selecionada ?? null,
    tamanho_selecionado: item.tamanho_selecionado ?? null,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) throw itemsError;

  return order;
}

export interface PedidoConsultado {
  numero: string;
  status: string;
  metodo_pagamento: string | null;
  subtotal: number;
  frete: number;
  total: number;
  criado_em: string;
  itens: {
    nome_produto: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    cor_selecionada: string | null;
    tamanho_selecionado: string | null;
  }[];
}

/**
 * Consulta os pedidos do cliente por CPF + telefone (os dois
 * precisam bater). Usa uma função do banco (security definer)
 * em vez de select direto — evita expor pedidos de terceiros
 * por tentativa de CPF isolado.
 */
export async function consultarPedidosPublico(
  storeId: string,
  cpf: string,
  telefone: string
): Promise<PedidoConsultado[]> {
  const { data, error } = await supabase.rpc("consultar_pedidos_publico", {
    p_store_id: storeId,
    p_cpf: cpf,
    p_telefone: telefone,
  });

  if (error) throw error;
  return data ?? [];
}
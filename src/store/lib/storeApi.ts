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
  tamanhos: { id?: string; tamanho: string }[];
  item_promocao: boolean;
}

const PRODUCT_SELECT =
  "id, nome, slug, descricao, sku, preco, preco_promocional, estoque, permite_venda_sem_estoque, category_id, categories(nome), product_images(url, posicao), product_colors(id,nome,codigo_hex,imagem_url), product_sizes(id,tamanho), item_promocao";

function mapProduct(p: any): PublicProduct {
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

export async function listPublicProducts(
  storeId: string
): Promise<PublicProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("store_id", storeId)
    .eq("status", "ativo")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function getPublicProductBySlug(
  storeId: string,
  productSlug: string
): Promise<PublicProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("store_id", storeId)
    .eq("slug", productSlug)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProduct(data);
}

export interface CartItemInput {
  product_id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  cor_selecionada?: string;
  tamanho_selecionado?: string;
}

export interface EnderecoEntrega {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface FreteEscolhido {
  servicoId: number;
  nome: string;
  transportadora: string;
  preco: number;
  prazoDias: number;
}

export interface CheckoutInput {
  storeId: string;
  itens: CartItemInput[];
  /**
   * O que o cliente ESCOLHEU no checkout.
   *
   * Crédito e débito são escolhas separadas na tela porque é assim
   * que o brasileiro espera pagar — mas viram a MESMA cobrança na
   * Stripe, que não distingue os dois na hora de cobrar. O que foi
   * de fato usado é lido do cartão e gravado em payments.cartao_tipo.
   */
  metodoPagamento:
    | "pix"
    | "cartao_credito"
    | "cartao_debito"
    | null;
  cliente: {
    nome: string;
    telefone: string;
    cpf: string;
    email?: string;
  };
  enderecoEntrega?: EnderecoEntrega | null;
  frete?: FreteEscolhido | null;
}

/**
 * Cria o pedido no banco (cliente + pedido + itens), já com o
 * frete escolhido somado ao total. Usado tanto no fluxo de
 * WhatsApp quanto no de pagamento online.
 */
export async function createPublicOrder(input: CheckoutInput) {
  // 1. Garante o cliente (busca por CPF+telefone; cria se não existir)
  let customerId: string | null = null;

  const cpfDigits = input.cliente.cpf.replace(/\D/g, "");
  const telefoneDigits = input.cliente.telefone.replace(/\D/g, "");

  const emailLimpo = (input.cliente.email || "").trim().toLowerCase() || null;

  // Procura o cliente em ordem de confiabilidade: CPF, depois
  // telefone, depois e-mail.
  //
  // Antes exigia CPF **E** telefone iguais, os dois ao mesmo tempo.
  // Bastava o cliente ter comprado antes de a loja passar a pedir
  // CPF — ou ter digitado o CPF de um jeito diferente — para nascer
  // um cadastro novo. O mesmo comprador aparecia duas vezes na lista
  // de clientes, com o histórico partido ao meio.
  async function procurar(coluna: string, valor: string) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("store_id", input.storeId)
      .eq(coluna, valor)
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  if (cpfDigits) customerId = await procurar("cpf", cpfDigits);
  if (!customerId && telefoneDigits) {
    customerId = await procurar("telefone", telefoneDigits);
  }
  if (!customerId && emailLimpo) {
    customerId = await procurar("email", emailLimpo);
  }

  // Achado o cliente, os dados dele NÃO são sobrescritos daqui.
  // Esta função roda no navegador de quem está comprando, sem login:
  // deixar ela regravar nome e e-mail de um cadastro existente
  // permitiria trocar os dados de outra pessoa conhecendo só o
  // telefone. Quem corrige cadastro é o lojista, no painel.

  if (!customerId) {
    const { data: created, error: customerError } = await supabase
      .from("customers")
      .insert({
        store_id: input.storeId,
        nome: input.cliente.nome,
        telefone: telefoneDigits,
        cpf: cpfDigits,
        email: emailLimpo,
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
  const valorFrete = input.frete?.preco ?? 0;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: input.storeId,
      customer_id: customerId,
      status: "pendente",
      metodo_pagamento: input.metodoPagamento,
      subtotal,
      frete: valorFrete,
      total: subtotal + valorFrete,
      endereco_entrega: input.enderecoEntrega ?? null,
      cep_entrega: input.enderecoEntrega?.cep?.replace(/\D/g, "") || null,
      frete_servico: input.frete ? String(input.frete.servicoId) : null,
      frete_transportadora: input.frete
        ? `${input.frete.transportadora} ${input.frete.nome}`.trim()
        : null,
      frete_prazo_dias: input.frete?.prazoDias ?? null,
    })
    .select("id, numero")
    .single();

  if (orderError) throw orderError;

  // 3. Itens do pedido (com cor/tamanho)
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
  /** Necessário para o rastreio; só chega a quem já provou CPF + telefone. */
  id: string;
  numero: string;
  status: string;
  metodo_pagamento: string | null;
  subtotal: number;
  frete: number;
  total: number;
  valor_reembolsado: number;
  criado_em: string;
  codigo_rastreio: string | null;
  frete_transportadora: string | null;
  frete_prazo_dias: number | null;
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
 * Consulta os pedidos do cliente por CPF + telefone — os dois
 * precisam bater — através de uma função no banco.
 *
 * Só o CPF não basta, de propósito: com um campo só daria para
 * descobrir pedido de terceiro tentando CPFs. E a função nunca diz se
 * o CPF existe — CPF errado e cliente sem pedido devolvem a mesma
 * coisa, uma lista vazia.
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
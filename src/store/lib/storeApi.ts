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

  /* Meios de pagamento que a loja oferece (06_formas_pagamento.sql). */
  aceita_cartao?: boolean;
  aceita_pix?: boolean;

  /* Regras de frete (14_frete.sql).
     Ficam em `stores` justamente para a loja pública poder lê-las sem
     login — não são segredo, é preço de entrega. */
  frete_modo: "melhor_envio" | "fixo" | "combinar";
  frete_fixo: number | null;
  frete_fixo_prazo_dias: number | null;
  frete_fixo_nome: string | null;
  frete_gratis_acima: number | null;
  retirada_na_loja: boolean;
  retirada_instrucoes: string | null;
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
      "id, nome, slug, descricao, logo_url, banner_url, cor_primaria, cor_secundaria, whatsapp, email, politica_troca, politica_frete, modo_compra, ativo, aceita_cartao, aceita_pix, frete_modo, frete_fixo, frete_fixo_prazo_dias, frete_fixo_nome, frete_gratis_acima, retirada_na_loja, retirada_instrucoes"
    )
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // numeric do Postgres chega como string no JS. Sem converter aqui,
  // "199.00" >= 150 compara texto com número lá no checkout e o frete
  // grátis liga na hora errada.
  return {
    ...data,
    frete_modo: (data as any).frete_modo ?? "combinar",
    frete_fixo: numeroOuNulo((data as any).frete_fixo),
    frete_gratis_acima: numeroOuNulo((data as any).frete_gratis_acima),
    retirada_na_loja: Boolean((data as any).retirada_na_loja),
  } as PublicStore;
}

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

/**
 * O que o navegador tem direito de dizer sobre um item.
 *
 * Nome e preço saíram daqui de propósito: quem decide os dois é o
 * servidor, lendo a tabela de produtos. Manter os campos seria manter
 * a porta por onde o preço vinha adulterado.
 */
export interface CartItemInput {
  product_id: string;
  quantidade: number;
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
  /**
   * Código do serviço no Melhor Envio.
   *
   * NULO quando a entrega não passa por transportadora — valor fixo,
   * frete grátis ou retirada no balcão. É de propósito: é assim que a
   * geração de etiqueta sabe que não há nada para comprar lá, e recusa
   * com uma mensagem em vez de mandar lixo para a API deles.
   */
  servicoId: number | null;
  nome: string;
  transportadora: string;
  preco: number;
  prazoDias: number | null;
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
 * Cria o pedido.
 *
 * Todo o trabalho acontece no banco, numa função só
 * (19_checkout_seguro.sql). O navegador manda O QUE o cliente quer —
 * produto, quantidade, cor, tamanho, endereço — e o servidor decide
 * QUANTO custa, lendo o preço da tabela de produtos.
 *
 * Antes era o contrário: esta função mandava `preco_unitario` junto, e
 * o banco aceitava. Quem soubesse mexer na requisição comprava
 * qualquer coisa por um centavo, porque a cobrança na Stripe sai do
 * total do pedido. Por isso o preço sumiu daqui.
 *
 * E como quem grava é a função, o navegador não precisa mais de
 * permissão de escrita em tabela nenhuma — as políticas que abriam
 * `orders`, `order_items` e `customers` para visitantes foram
 * removidas, junto com uma que deixava QUALQUER pessoa ler os
 * clientes de todas as lojas.
 */
export async function createPublicOrder(input: CheckoutInput) {
  const { data, error } = await supabase.rpc("criar_pedido_publico", {
    p_store_id: input.storeId,
    p_cliente: {
      nome: input.cliente.nome,
      telefone: input.cliente.telefone,
      cpf: input.cliente.cpf,
      email: input.cliente.email ?? null,
    },
    p_itens: input.itens.map((i) => ({
      product_id: i.product_id,
      quantidade: i.quantidade,
      cor: i.cor_selecionada ?? null,
      tamanho: i.tamanho_selecionado ?? null,
    })),
    p_metodo: input.metodoPagamento,
    p_endereco: input.enderecoEntrega
      ? { ...input.enderecoEntrega, cep: input.enderecoEntrega.cep.replace(/\D/g, "") }
      : null,
    p_frete: input.frete
      ? {
          servicoId: input.frete.servicoId,
          nome: input.frete.nome,
          transportadora: input.frete.transportadora,
          preco: input.frete.preco,
          prazoDias: input.frete.prazoDias,
        }
      : null,
  });

  if (error) throw error;

  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido?.id) {
    throw new Error("Não foi possível registrar o pedido. Tente de novo.");
  }

  return pedido as { id: string; numero: string; total: number };
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
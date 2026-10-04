import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Variações do produto: a combinação de cor e tamanho que é, de
 * fato, a peça vendida.
 *
 * ----------------------------------------------------------------
 * Por que isto existe
 * ----------------------------------------------------------------
 * Antes, cor e tamanho eram duas listas soltas e o estoque era UM
 * número do produto. Um vestido com 3 cores e 5 tamanhos tinha 15
 * combinações representadas por um número só: vendida a última P
 * preta, a loja continuava aceitando pedido de P preta.
 *
 * ----------------------------------------------------------------
 * A regra que evita quebrar a loja de quem já vende
 * ----------------------------------------------------------------
 * Produto SEM variação cadastrada continua funcionando pelo
 * `products.estoque`, exatamente como antes. A grade é opcional e
 * entra produto a produto. Nada de preencher combinação com número
 * inventado só para a tabela não ficar vazia.
 */

export interface Variacao {
  id: string;
  product_id: string;
  store_id: string;
  /** Rótulo montado pelo banco: "Preto · M", ou "Padrão". */
  nome: string | null;
  cor_nome: string | null;
  cor_hex: string | null;
  cor_imagem_url: string | null;
  tamanho: string | null;
  sku: string | null;
  codigo_barras: string | null;
  preco: number | null;
  estoque: number;
  estoque_minimo: number;
  ativa: boolean;
  ordem: number;
}

/** O que o formulário manda. Sem id = linha nova. */
export interface VariacaoInput {
  id?: string;
  cor_nome: string | null;
  cor_hex: string | null;
  cor_imagem_url: string | null;
  tamanho: string | null;
  sku: string | null;
  codigo_barras: string | null;
  preco: number | null;
  estoque: number;
  estoque_minimo: number;
  ativa: boolean;
}

/**
 * Traduz o erro cru do Postgres.
 *
 * 23505 é violação de índice único. Sem isto o lojista recebe
 * "duplicate key value violates unique constraint
 * product_variants_sku_por_loja", que não diz nada para quem está
 * cadastrando uma camiseta.
 */
export function traduzirErro(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? "";

  if (e?.code === "23505" || msg.includes("duplicate key")) {
    if (msg.includes("product_variants_sku_por_loja") || msg.includes("products_sku_por_loja")) {
      return "Esse SKU já está em uso em outro item da sua loja. Cada SKU precisa ser único.";
    }
    if (msg.includes("product_variants_combinacao")) {
      return "Essa combinação de cor e tamanho já existe neste produto.";
    }
    if (msg.includes("products_slug_por_loja")) {
      return "Já existe um produto com esse nome na sua loja. Mude o nome ou acrescente algo que diferencie.";
    }
    if (msg.includes("products_codigo_por_loja")) {
      return "Houve um conflito ao numerar o produto. Tente salvar de novo.";
    }
    return "Esse valor já está em uso em outro item da sua loja.";
  }

  if (msg.includes("não pode ser alterado")) {
    return "O código do produto é definido pelo sistema e não muda.";
  }

  return msg || "Erro ao salvar.";
}

export async function listarVariacoes(productId: string): Promise<Variacao[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, store_id, nome, cor_nome, cor_hex, cor_imagem_url, tamanho, sku, codigo_barras, preco, estoque, estoque_minimo, ativa, ordem",
    )
    .eq("product_id", productId)
    .order("ordem")
    .order("nome");

  if (error) throw error;
  return (data ?? []) as Variacao[];
}

/**
 * Grava a grade inteira de um produto.
 *
 * Apaga o que o lojista tirou, atualiza o que ficou e insere o que
 * entrou — em vez de apagar tudo e reinserir. Apagar e recriar
 * mudaria o id da variação, e `order_items.variant_id` aponta para
 * ele: o pedido antigo perderia a referência da peça vendida.
 */
export async function salvarVariacoes(
  productId: string,
  linhas: VariacaoInput[],
): Promise<void> {
  const atuais = await listarVariacoes(productId);
  const mantidos = new Set(linhas.map((l) => l.id).filter(Boolean) as string[]);

  const paraApagar = atuais.filter((a) => !mantidos.has(a.id)).map((a) => a.id);
  if (paraApagar.length) {
    const { error } = await supabase
      .from("product_variants")
      .delete()
      .in("id", paraApagar);
    if (error) throw error;
  }

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const campos = {
      product_id: productId,
      cor_nome: l.cor_nome?.trim() || null,
      cor_hex: l.cor_hex?.trim() || null,
      cor_imagem_url: l.cor_imagem_url?.trim() || null,
      tamanho: l.tamanho?.trim() || null,
      sku: l.sku?.trim() || null,
      codigo_barras: l.codigo_barras?.trim() || null,
      preco: l.preco,
      estoque: l.estoque,
      estoque_minimo: l.estoque_minimo,
      ativa: l.ativa,
      ordem: i,
    };

    const { error } = l.id
      ? await supabase.from("product_variants").update(campos).eq("id", l.id)
      : await supabase.from("product_variants").insert(campos);

    if (error) throw error;
  }
}

// ----------------------------------------------------------------
// Preço de custo
//
// Mora em `product_costs`, tabela separada, sem permissão nenhuma
// para o visitante da loja. Se fosse coluna de `products`, qualquer
// pessoa com o endereço da loja leria quanto o lojista paga no
// fornecedor — o visitante lê todas as colunas daquela tabela.
// ----------------------------------------------------------------

/** Custo do produto (variant_id nulo) ou de uma variação. */
export async function lerCusto(
  productId: string,
  variantId?: string | null,
): Promise<number | null> {
  let q = supabase
    .from("product_costs")
    .select("preco_custo")
    .eq("product_id", productId);

  q = variantId ? q.eq("variant_id", variantId) : q.is("variant_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? Number(data.preco_custo) : null;
}

export async function salvarCusto(
  productId: string,
  valor: number | null,
  variantId?: string | null,
): Promise<void> {
  if (valor === null || Number.isNaN(valor)) {
    let q = supabase.from("product_costs").delete().eq("product_id", productId);
    q = variantId ? q.eq("variant_id", variantId) : q.is("variant_id", null);
    const { error } = await q;
    if (error) throw error;
    return;
  }

  const existente = await lerCusto(productId, variantId);

  if (existente === null) {
    const { error } = await supabase.from("product_costs").insert({
      product_id: productId,
      variant_id: variantId ?? null,
      preco_custo: valor,
    });
    if (error) throw error;
    return;
  }

  let q = supabase
    .from("product_costs")
    .update({ preco_custo: valor, updated_at: new Date().toISOString() })
    .eq("product_id", productId);
  q = variantId ? q.eq("variant_id", variantId) : q.is("variant_id", null);
  const { error } = await q;
  if (error) throw error;
}

// ----------------------------------------------------------------
// SKU sugerido e margem
// ----------------------------------------------------------------

function sigla(texto: string, tamanho: number): string {
  const limpo = (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return limpo.slice(0, tamanho);
}

/**
 * Monta a sugestão de SKU no formato que Nuvemshop e Shopify
 * recomendam: letras da categoria, o código do produto com quatro
 * dígitos, e o que diferencia a variação.
 *
 * Exemplo: CAM-0047-PRT-M
 *
 * É SUGESTÃO. O lojista edita. Travar o campo quebraria quem já tem
 * código próprio, quem recebe o código do fornecedor na nota, e
 * quem precisa casar o SKU com o catálogo do Instagram.
 */
export function sugerirSku(opcoes: {
  categoria?: string | null;
  nomeProduto?: string | null;
  codigo?: number | null;
  cor?: string | null;
  tamanho?: string | null;
}): string {
  const base = sigla(opcoes.categoria || opcoes.nomeProduto || "PRD", 3) || "PRD";
  const num = String(opcoes.codigo ?? 0).padStart(4, "0");

  const partes = [base, num];
  const cor = sigla(opcoes.cor || "", 3);
  if (cor) partes.push(cor);
  const tam = sigla(opcoes.tamanho || "", 3);
  if (tam) partes.push(tam);

  return partes.join("-").slice(0, 20);
}

/** Margem sobre o preço de venda, em por cento. Null quando não dá para calcular. */
export function margem(preco: number | null, custo: number | null): number | null {
  if (!preco || preco <= 0 || custo === null || custo < 0) return null;
  return ((preco - custo) / preco) * 100;
}

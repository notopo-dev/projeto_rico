import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Estoque da loja.
 *
 * ----------------------------------------------------------------
 * Por que a grade mudou esta tela
 * ----------------------------------------------------------------
 * Antes isto lia e gravava `products.estoque`, um número por
 * produto. Com grade montada esse número virou a SOMA das
 * variações, mantida pelo banco — e gravar nele à mão passou a não
 * ter efeito nenhum: um gatilho troca o valor pela soma real.
 *
 * Deixar o campo editável seria pior do que removê-lo: o lojista
 * digitava 40, via "salvo", e o número voltava sozinho. Agora quem
 * tem grade edita gaveta por gaveta, e o total aparece só como
 * leitura.
 *
 * É a regra que os ERPs aplicam. A Omie recusa movimentar o produto
 * pai: "esse produto possui variações e não pode ser movimentado".
 */

export type SituacaoEstoque = "ok" | "baixo" | "sem";

/** Uma gaveta: esta cor neste tamanho. */
export interface VariacaoEstoque {
  id: string;
  /** Rótulo montado pelo banco: "Preto · M". */
  nome: string;
  sku: string | null;
  estoque: number;
  minimo: number;
  situacao: SituacaoEstoque;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  estoque: number;
  minimo: number;
  preco: number;
  situacao: SituacaoEstoque;
  /** Vazio = produto sem grade, que continua editável como antes. */
  variacoes: VariacaoEstoque[];
  temGrade: boolean;
  /** Quantas gavetas estão zeradas. Zero quando não há grade. */
  gavetasSemPeca: number;
  /** Quantas gavetas estão no mínimo ou abaixo. */
  gavetasAcabando: number;
}

function situacao(estoque: number, minimo: number): SituacaoEstoque {
  if (estoque <= 0) return "sem";
  if (minimo > 0 && estoque <= minimo) return "baixo";
  return "ok";
}

export async function listarEstoque(): Promise<ItemEstoque[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, nome, sku, estoque, estoque_minimo, preco, categories(nome), " +
        "product_variants(id, nome, sku, estoque, estoque_minimo, ativa, ordem)",
    )
    .eq("store_id", storeId)
    .order("nome");

  if (error) throw error;

  return (data ?? []).map((p: any) => {
    const estoque = Number(p.estoque ?? 0);
    const minimo = Number(p.estoque_minimo ?? 0);

    // Variação desativada fica de fora: ela não vende, então não é
    // estoque a repor. Continua no banco pelo histórico dos pedidos.
    const variacoes: VariacaoEstoque[] = ((p.product_variants ?? []) as any[])
      .filter((v) => v?.ativa !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((v) => {
        const e = Number(v.estoque ?? 0);
        const m = Number(v.estoque_minimo ?? 0);
        return {
          id: v.id,
          nome: v.nome ?? "Variação",
          sku: v.sku ?? null,
          estoque: e,
          minimo: m,
          situacao: situacao(e, m),
        };
      });

    return {
      id: p.id,
      nome: p.nome,
      sku: p.sku ?? null,
      categoria: p.categories?.nome ?? null,
      estoque,
      minimo,
      preco: Number(p.preco ?? 0),
      situacao: situacao(estoque, minimo),
      variacoes,
      temGrade: variacoes.length > 0,
      gavetasSemPeca: variacoes.filter((v) => v.situacao === "sem").length,
      gavetasAcabando: variacoes.filter((v) => v.situacao === "baixo").length,
    };
  });
}

/**
 * Grava a nova quantidade de um produto SEM grade.
 *
 * Recusa produto com grade em vez de deixar passar: o banco ignora
 * a gravação (o total é a soma das variações), e um "salvo" que não
 * salva é pior do que um aviso.
 *
 * Recusa número negativo: contagem de prateleira não dá negativo.
 * Saldo negativo existe, mas só como consequência de venda com
 * "permite venda sem estoque" ligado — não se digita à mão.
 */
export async function ajustarEstoque(
  produtoId: string,
  novaQuantidade: number,
): Promise<void> {
  if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
    throw new Error("A quantidade precisa ser zero ou mais.");
  }

  const storeId = await getCurrentStoreId();

  // Confere a grade no servidor, não na tela: a tela pode estar
  // desatualizada se outra aba cadastrou variações faz um minuto.
  const { count, error: erroGrade } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", produtoId);

  if (erroGrade) throw erroGrade;

  if ((count ?? 0) > 0) {
    throw new Error(
      "Este produto tem grade de cor e tamanho. Ajuste o estoque de cada combinação — o total é a soma delas.",
    );
  }

  const { error } = await supabase
    .from("products")
    .update({ estoque: Math.floor(novaQuantidade) })
    .eq("id", produtoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Grava a nova quantidade de UMA gaveta da grade.
 *
 * O total do produto se ajusta sozinho: o gatilho do banco soma as
 * variações depois desta gravação. Não há nada a atualizar aqui.
 */
export async function ajustarEstoqueVariacao(
  variacaoId: string,
  novaQuantidade: number,
): Promise<void> {
  if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
    throw new Error("A quantidade precisa ser zero ou mais.");
  }

  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("product_variants")
    .update({ estoque: Math.floor(novaQuantidade) })
    .eq("id", variacaoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

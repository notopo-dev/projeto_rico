import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Estoque da loja.
 *
 * Esta tela tinha `const initialItems: StockItem[] = []` escrito no
 * código, com um comentário dizendo que os produtos viriam do Supabase
 * "posteriormente". Nunca vieram.
 *
 * Consulta enxuta de propósito: a de Produtos traz imagens, cores e
 * tamanhos, que aqui não servem para nada e só deixam a tela lenta.
 */

export type SituacaoEstoque = "ok" | "baixo" | "sem";

export interface ItemEstoque {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  estoque: number;
  minimo: number;
  preco: number;
  situacao: SituacaoEstoque;
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
    .select("id, nome, sku, estoque, estoque_minimo, preco, categories(nome)")
    .eq("store_id", storeId)
    .order("nome");

  if (error) throw error;

  return (data ?? []).map((p: any) => {
    const estoque = Number(p.estoque ?? 0);
    const minimo = Number(p.estoque_minimo ?? 0);
    return {
      id: p.id,
      nome: p.nome,
      sku: p.sku ?? null,
      categoria: p.categories?.nome ?? null,
      estoque,
      minimo,
      preco: Number(p.preco ?? 0),
      situacao: situacao(estoque, minimo),
    };
  });
}

/**
 * Grava a nova quantidade de um produto.
 *
 * Recusa número negativo: estoque negativo não existe no mundo, e
 * deixar entrar aqui contamina o cálculo de "sem estoque" da vitrine.
 */
export async function ajustarEstoque(
  produtoId: string,
  novaQuantidade: number,
): Promise<void> {
  if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
    throw new Error("A quantidade precisa ser zero ou mais.");
  }

  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("products")
    .update({ estoque: Math.floor(novaQuantidade) })
    .eq("id", produtoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

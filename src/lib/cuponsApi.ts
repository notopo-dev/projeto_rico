import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Cupons de desconto da loja — lado do lojista.
 *
 * ----------------------------------------------------------------
 * Esta API não calcula desconto
 * ----------------------------------------------------------------
 * Ela só cadastra a REGRA. Quem aplica e faz a conta é a função
 * `aplicar_cupom` no banco, chamada pelo checkout.
 *
 * A separação é de propósito: se o desconto fosse calculado em
 * TypeScript, o valor viajaria do navegador do comprador até o
 * pedido, e aí qualquer pessoa manda o número que quiser.
 */

export type TipoCupom = "percentual" | "valor";

export interface Cupom {
  id: string;
  codigo: string;
  tipo: TipoCupom;
  valor: number;
  minimo_compra: number | null;
  frete_gratis: boolean;
  comeca_em: string | null;
  expira_em: string | null;
  limite_total: number | null;
  limite_por_cliente: number | null;
  ativo: boolean;
  created_at: string;
  /** Quantas vezes já foi usado. Vem do banco, contado dos pedidos. */
  usos: number;
}

export interface CupomInput {
  codigo: string;
  tipo: TipoCupom;
  valor: number;
  minimo_compra: number | null;
  frete_gratis: boolean;
  comeca_em: string | null;
  expira_em: string | null;
  limite_total: number | null;
  limite_por_cliente: number | null;
  ativo: boolean;
}

/** Traduz o erro do banco para algo que o lojista entende. */
function erroDeCupom(error: { code?: string; message?: string }): Error {
  // 23505 = unique_violation no índice coupons_codigo_por_loja.
  if (error.code === "23505") {
    return new Error("Já existe um cupom com esse código na sua loja.");
  }
  // 23514 = check_violation. As restrições têm nome falante.
  if (error.code === "23514") {
    if (error.message?.includes("percentual_ate_100")) {
      return new Error("Desconto em porcentagem não pode passar de 100%.");
    }
    if (error.message?.includes("validade_coerente")) {
      return new Error("A data de fim precisa ser depois da data de início.");
    }
    return new Error("Algum valor do cupom está fora do permitido.");
  }
  return new Error(error.message || "Não foi possível salvar o cupom.");
}

export async function listarCupons(): Promise<Cupom[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("coupons")
    .select(
      "id, codigo, tipo, valor, minimo_compra, frete_gratis, comeca_em, " +
        "expira_em, limite_total, limite_por_cliente, ativo, created_at",
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const linhas = (data ?? []) as any[];

  /**
   * Os usos de TODOS os cupons numa chamada.
   *
   * A primeira versão chamava `cupom_usos` uma vez por cupom: vinte
   * cupons, vinte idas ao servidor em série. A `cupom_usos_da_loja`
   * devolve um mapa { id: usos } de uma vez.
   *
   * Se essa chamada falhar, a lista ainda aparece com usos em zero —
   * é melhor mostrar os cupons sem a contagem do que a tela inteira
   * dar erro por causa de um número informativo.
   */
  let mapaUsos: Record<string, number> = {};
  const { data: contagem } = await supabase.rpc("cupom_usos_da_loja", {
    p_store_id: storeId,
  });
  if (contagem && typeof contagem === "object") {
    mapaUsos = contagem as Record<string, number>;
  }

  return linhas.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    valor: Number(c.valor),
    minimo_compra: c.minimo_compra === null ? null : Number(c.minimo_compra),
    frete_gratis: Boolean(c.frete_gratis),
    comeca_em: c.comeca_em,
    expira_em: c.expira_em,
    limite_total: c.limite_total,
    limite_por_cliente: c.limite_por_cliente,
    ativo: Boolean(c.ativo),
    created_at: c.created_at,
    usos: mapaUsos[c.id] ?? 0,
  }));
}

/** Normaliza como o banco compara: sem espaço nas pontas, maiúsculo. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export async function criarCupom(input: CupomInput): Promise<void> {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase.from("coupons").insert({
    store_id: storeId,
    ...input,
    codigo: normalizarCodigo(input.codigo),
  });

  if (error) throw erroDeCupom(error);
}

export async function atualizarCupom(
  id: string,
  input: CupomInput,
): Promise<void> {
  const { error } = await supabase
    .from("coupons")
    .update({ ...input, codigo: normalizarCodigo(input.codigo) })
    .eq("id", id);

  if (error) throw erroDeCupom(error);
}

/**
 * Liga e desliga o cupom.
 *
 * Desligar em vez de apagar: o pedido antigo aponta para o cupom, e
 * apagar a regra deixaria o histórico sem explicação de por que
 * aquele pedido teve desconto.
 */
export async function alternarCupom(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from("coupons")
    .update({ ativo })
    .eq("id", id);

  if (error) throw new Error(error.message || "Não foi possível alterar.");
}

/**
 * Apaga o cupom — só se nunca foi usado.
 *
 * A coluna `orders.cupom_id` é `on delete set null`, então apagar um
 * cupom usado não quebra pedido nenhum, mas apaga a explicação do
 * desconto que aparece no histórico. Então a tela só oferece apagar
 * para cupom com zero usos.
 */
export async function apagarCupom(id: string): Promise<void> {
  const { data: usos } = await supabase.rpc("cupom_usos", {
    p_coupon_id: id,
  });

  if (typeof usos === "number" && usos > 0) {
    throw new Error(
      "Este cupom já foi usado em pedidos. Desligue em vez de apagar, " +
        "para o histórico continuar explicando o desconto.",
    );
  }

  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error(error.message || "Não foi possível apagar.");
}

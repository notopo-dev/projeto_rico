import { supabase } from "../../lib/supabaseClient";

/**
 * Cupom de desconto — lado de quem está comprando.
 *
 * ----------------------------------------------------------------
 * Só o CÓDIGO sobe daqui
 * ----------------------------------------------------------------
 * Esta função manda o texto que a cliente digitou e o id do pedido.
 * Nada mais. O desconto, o novo frete e o novo total vêm do banco.
 *
 * Se o valor fosse calculado aqui, bastaria abrir o console do
 * navegador e mandar outro número — e a loja entregaria a roupa de
 * graça sem ninguém perceber até o fim do mês.
 */

export interface CupomAplicado {
  codigo: string;
  desconto: number;
  /** Quanto do frete o cupom abateu. */
  desconto_frete: number;
  /** O frete da transportadora, que o cupom não altera. */
  frete: number;
  total: number;
  frete_gratis: boolean;
}

/**
 * Traduz o erro do banco.
 *
 * As mensagens da função `aplicar_cupom` já são escritas para a
 * cliente ler ("Este cupom já expirou."), então sobem como estão.
 * O que não pode subir é o texto cru do Postgres quando o erro é de
 * infraestrutura.
 */
function mensagem(error: { message?: string; code?: string }): string {
  const m = error.message ?? "";

  // Erro vindo de `raise exception` chega como P0001.
  if (error.code === "P0001" && m) return m;

  if (/network|fetch/i.test(m)) {
    return "Sem conexão. Tente de novo.";
  }
  return "Não foi possível aplicar o cupom.";
}

export async function aplicarCupom(
  orderId: string,
  codigo: string,
): Promise<CupomAplicado> {
  const { data, error } = await supabase.rpc("aplicar_cupom", {
    p_order_id: orderId,
    p_codigo: codigo,
  });

  if (error) throw new Error(mensagem(error));
  if (!data) throw new Error("Não foi possível aplicar o cupom.");

  const d = data as Record<string, unknown>;
  return {
    codigo: String(d.codigo ?? codigo),
    desconto: Number(d.desconto ?? 0),
    desconto_frete: Number(d.desconto_frete ?? 0),
    frete: Number(d.frete ?? 0),
    total: Number(d.total ?? 0),
    frete_gratis: Boolean(d.frete_gratis),
  };
}

export async function removerCupom(
  orderId: string,
): Promise<{ total: number }> {
  const { data, error } = await supabase.rpc("remover_cupom", {
    p_order_id: orderId,
  });

  if (error) throw new Error(mensagem(error));

  const d = (data ?? {}) as Record<string, unknown>;
  return { total: Number(d.total ?? 0) };
}

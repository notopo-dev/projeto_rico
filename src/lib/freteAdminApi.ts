import { supabase } from "./supabaseClient";

export interface EtiquetaResultado {
  sucesso?: boolean;
  jaExiste?: boolean;
  melhorEnvioOrderId: string;
  etiquetaUrl?: string | null;
  codigoRastreio?: string | null;
}

/**
 * Gera a etiqueta de envio de um pedido (fluxo do lojista).
 * Registra o envio no Melhor Envio, paga com o saldo da conta
 * e devolve o link do PDF da etiqueta.
 */
export async function gerarEtiqueta(orderId: string): Promise<EtiquetaResultado> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/frete-gerar-etiqueta`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Erro ao gerar etiqueta (status ${res.status}).`);
  }

  return corpo as EtiquetaResultado;
}

/**
 * Rastreia um pedido pelo painel do lojista.
 */
export async function rastrearPedidoAdmin(orderId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/frete-rastrear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Erro ao rastrear (status ${res.status}).`);
  }

  return corpo;
}
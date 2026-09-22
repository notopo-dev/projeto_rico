import { supabase } from "../../lib/supabaseClient";

export interface OpcaoFrete {
  id: number;
  nome: string;
  transportadora: string;
  preco: number;
  prazo_dias: number;
}

/**
 * Calcula as opções de frete para o carrinho, a partir do CEP
 * informado pelo cliente na loja pública.
 */
export async function calcularFrete(
  storeId: string,
  cepDestino: string,
  itens: { product_id: string; quantidade: number }[]
): Promise<OpcaoFrete[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/frete-calcular`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storeId, cepDestino, itens }),
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Erro ao calcular frete (status ${res.status}).`);
  }

  return (corpo.opcoes ?? []) as OpcaoFrete[];
}

export interface RastreioEvento {
  status?: string;
  description?: string;
  date?: string;
  location?: string;
}

export interface RastreioResultado {
  codigoRastreio: string | null;
  status: string | null;
  eventos: RastreioEvento[];
  semEnvio?: boolean;
  mensagem?: string;
}

/**
 * Rastreia um pedido. Na loja pública, o cliente precisa
 * informar CPF e telefone (mesma validação da consulta de
 * pedidos).
 */
export async function rastrearPedidoPublico(
  orderId: string,
  storeId: string,
  cpf: string,
  telefone: string
): Promise<RastreioResultado> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/frete-rastrear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, storeId, cpf, telefone }),
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

  return corpo as RastreioResultado;
}
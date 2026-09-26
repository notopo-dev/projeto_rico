import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Pedidos da loja.
 *
 * O isolamento entre lojas é garantido pelo RLS (03_rls_relatorios.sql).
 * O filtro por store_id aqui é conveniência, não proteção: quem recusa
 * um pedido adulterado é o banco.
 */

export type StatusPedido =
  | "pendente"
  | "pago"
  | "enviado"
  | "entregue"
  | "cancelado";

export interface ItemPedido {
  id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  cor_selecionada: string | null;
  tamanho_selecionado: string | null;
}

export interface EnderecoEntrega {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

export interface Pedido {
  id: string;
  numero: number;
  status: StatusPedido;
  total: number;
  frete: number;
  metodo_pagamento: string | null;
  created_at: string;

  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;

  endereco_entrega: EnderecoEntrega | null;
  frete_transportadora: string | null;
  frete_prazo_dias: number | null;
  codigo_rastreio: string | null;

  itens: ItemPedido[];
}

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const ROTULO_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  cartao_stripe: "Cartão",
  card: "Cartão",
  boleto: "Boleto",
  whatsapp: "Combinado no WhatsApp",
  dinheiro: "Dinheiro",
};

/**
 * O que pode virar o quê.
 * Evita retrocesso acidental (marcar como pendente um pedido entregue)
 * e deixa claro na interface qual é o próximo passo natural.
 */
export const PROXIMOS_STATUS: Record<StatusPedido, StatusPedido[]> = {
  pendente: ["pago", "cancelado"],
  pago: ["enviado", "cancelado"],
  enviado: ["entregue"],
  entregue: [],
  cancelado: [],
};

export async function listarPedidos(): Promise<Pedido[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, numero, status, total, frete, metodo_pagamento, created_at,
      endereco_entrega, frete_transportadora, frete_prazo_dias,
      codigo_rastreio,
      customers(nome, telefone, email),
      order_items(
        id, nome_produto, quantidade, preco_unitario, subtotal,
        cor_selecionada, tamanho_selecionado
      )
    `
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((o: any) => ({
    id: o.id,
    numero: o.numero,
    status: (o.status ?? "pendente") as StatusPedido,
    total: Number(o.total ?? 0),
    frete: Number(o.frete ?? 0),
    metodo_pagamento: o.metodo_pagamento ?? null,
    created_at: o.created_at,

    cliente_nome: o.customers?.nome ?? null,
    cliente_telefone: o.customers?.telefone ?? null,
    cliente_email: o.customers?.email ?? null,

    endereco_entrega: o.endereco_entrega ?? null,
    frete_transportadora: o.frete_transportadora ?? null,
    frete_prazo_dias: o.frete_prazo_dias ?? null,
    codigo_rastreio: o.codigo_rastreio ?? null,

    itens: (o.order_items ?? []).map((i: any) => ({
      id: i.id,
      nome_produto: i.nome_produto,
      quantidade: Number(i.quantidade ?? 0),
      preco_unitario: Number(i.preco_unitario ?? 0),
      subtotal: Number(i.subtotal ?? 0),
      cor_selecionada: i.cor_selecionada ?? null,
      tamanho_selecionado: i.tamanho_selecionado ?? null,
    })),
  }));
}

/**
 * Muda o status de um pedido.
 *
 * A transição é validada aqui e o RLS garante que o pedido é mesmo
 * da loja de quem está pedindo — um `update` em pedido de outra loja
 * não encontra a linha e não altera nada.
 */
export async function atualizarStatusPedido(
  pedidoId: string,
  novo: StatusPedido,
  atual: StatusPedido
): Promise<void> {
  if (!PROXIMOS_STATUS[atual]?.includes(novo)) {
    throw new Error(
      `Não dá para mudar de "${ROTULO_STATUS[atual]}" para "${ROTULO_STATUS[novo]}".`
    );
  }

  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("orders")
    .update({ status: novo })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

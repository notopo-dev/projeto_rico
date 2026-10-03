import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Pedidos da loja.
 *
 * O isolamento entre lojas é garantido pelo RLS (03_rls_relatorios.sql
 * e 04_pedidos_gestao.sql). O filtro por store_id daqui é conveniência,
 * não proteção: quem recusa um pedido adulterado é o banco.
 */

/**
 * O status antigo, de campo único.
 *
 * Continua existindo, e continua certo: um gatilho no banco o mantém
 * em dia a partir dos três eixos abaixo. Quem ainda lê por aqui — a
 * tela de clientes, a consulta pública de pedidos — não precisou
 * mudar nada.
 *
 * Para código novo, prefira os eixos. Este campo não consegue
 * distinguir "vai pagar no balcão" de "abandonou o carrinho", que é
 * exatamente o problema que os eixos vieram resolver.
 */
export type StatusPedido =
  | "pendente"
  | "pago"
  | "enviado"
  | "entregue"
  | "cancelado"
  | "devolvido";

/**
 * Os três eixos, que é como Nuvemshop e Shopify modelam pedido.
 *
 * Pagar e entregar são coisas independentes: um pedido pode estar
 * pago e não entregue, ou entregue e pago só na hora (o do balcão).
 * Espremer os dois numa coluna só foi o que fez "pendente" significar
 * duas coisas opostas ao mesmo tempo.
 */
export type StatusPagamento =
  | "pendente"
  /** Reservado: o cliente acerta no balcão, ao retirar. */
  | "na_retirada"
  | "pago"
  | "estornado";

export type StatusEntrega =
  | "a_separar"
  | "separando"
  /** Só em pedido de retirada: separado e esperando o cliente. */
  | "pronto_retirada"
  | "enviado"
  | "entregue";

export type Situacao = "ativa" | "cancelada";

export type StatusEtiqueta =
  | "pendente"
  | "paga"
  | "gerada"
  | "postada"
  | "entregue"
  | "cancelada";

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
  numero: string;
  status: StatusPedido;
  status_pagamento: StatusPagamento;
  status_entrega: StatusEntrega;
  situacao: Situacao;
  /** Quando o lojista abriu este pedido. Nulo = novo, não lido. */
  visto_em: string | null;
  total: number;
  frete: number;
  metodo_pagamento: string | null;
  /** Quanto o cliente vai entregar em dinheiro, para separar o troco. */
  troco_para: number | null;
  created_at: string;

  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_cpf: string | null;

  endereco_entrega: EnderecoEntrega | null;
  cep_entrega: string | null;
  frete_transportadora: string | null;
  frete_prazo_dias: number | null;
  frete_servico: string | null;

  codigo_rastreio: string | null;
  etiqueta_url: string | null;
  etiqueta_status: StatusEtiqueta | null;
  melhor_envio_order_id: string | null;

  valor_reembolsado: number;
  reembolsado_em: string | null;
  motivo_reembolso: string | null;

  observacoes_internas: string | null;

  /**
   * Como o cartão foi de fato usado, dito pela Stripe — não perguntado
   * ao cliente. Nulo em pedido sem cartão ou anterior a este registro.
   */
  cartao_tipo: "credit" | "debit" | "prepaid" | "unknown" | null;
  cartao_bandeira: string | null;
  cartao_final: string | null;

  itens: ItemPedido[];
}

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  pendente: "Aguardando pagamento",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  devolvido: "Devolvido",
};

export const ROTULO_PAGAMENTO_STATUS: Record<StatusPagamento, string> = {
  pendente: "Aguardando pagamento",
  na_retirada: "Paga ao retirar",
  pago: "Pago",
  estornado: "Estornado",
};

export const ROTULO_ENTREGA: Record<StatusEntrega, string> = {
  a_separar: "A separar",
  separando: "Separando",
  pronto_retirada: "Pronto para retirada",
  enviado: "Enviado",
  entregue: "Entregue",
};

/** Versão curta, para caber na etiqueta colorida da lista. */
export const ROTULO_CURTO: Record<StatusPedido, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  devolvido: "Devolvido",
};

/** Como a Stripe nomeia o tipo de cartão, em português. */
export const ROTULO_CARTAO: Record<string, string> = {
  credit: "Crédito",
  debit: "Débito",
  prepaid: "Pré-pago",
  unknown: "Cartão",
};

/** Bandeiras com grafia que o lojista reconhece. */
export const ROTULO_BANDEIRA: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
  diners: "Diners",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  unknown: "Bandeira não identificada",
};

/**
 * Como descrever o pagamento numa linha só.
 * Ex.: "Crédito · Mastercard ••••4178"
 */
export function descreverPagamento(p: {
  metodo_pagamento: string | null;
  cartao_tipo: string | null;
  cartao_bandeira: string | null;
  cartao_final: string | null;
}): string {
  if (!p.cartao_tipo && !p.cartao_bandeira) {
    return p.metodo_pagamento
      ? (ROTULO_PAGAMENTO[p.metodo_pagamento] ?? p.metodo_pagamento)
      : "Não informado";
  }

  const partes: string[] = [];
  if (p.cartao_tipo) partes.push(ROTULO_CARTAO[p.cartao_tipo] ?? "Cartão");

  const bandeira = p.cartao_bandeira
    ? (ROTULO_BANDEIRA[p.cartao_bandeira] ?? p.cartao_bandeira)
    : null;

  if (bandeira && p.cartao_final) partes.push(`${bandeira} ••••${p.cartao_final}`);
  else if (bandeira) partes.push(bandeira);
  else if (p.cartao_final) partes.push(`••••${p.cartao_final}`);

  return partes.join(" · ");
}

/**
 * O cliente escolheu uma coisa e o cartão era outra?
 *
 * Acontece de verdade, e não é erro de ninguém: cartão múltiplo é
 * crédito e débito no mesmo plástico, e a maquininha da Stripe decide
 * pelo BIN. Vale mostrar no pedido para o lojista não achar que o
 * relatório está errado.
 */
export function divergenciaCartao(p: {
  metodo_pagamento: string | null;
  cartao_tipo: string | null;
}): string | null {
  if (!p.cartao_tipo || !p.metodo_pagamento) return null;

  const escolheu =
    p.metodo_pagamento === "cartao_credito"
      ? "credit"
      : p.metodo_pagamento === "cartao_debito"
        ? "debit"
        : null;

  if (!escolheu || escolheu === p.cartao_tipo) return null;

  return `O cliente escolheu ${
    escolheu === "credit" ? "crédito" : "débito"
  }, mas o cartão foi processado como ${
    p.cartao_tipo === "credit" ? "crédito" : "débito"
  }.`;
}

export const ROTULO_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  cartao_stripe: "Cartão",
  card: "Cartão",
  boleto: "Boleto",
  whatsapp: "Combinado no WhatsApp",
  // Acertados no balcão, na hora da retirada. Nenhum dos dois passa
  // pela cobrança online: o pedido fica pendente até o lojista dizer
  // que recebeu.
  dinheiro: "Dinheiro, na retirada",
  maquininha: "Cartão na maquininha, na retirada",
};

/** Pagos no balcão — o sistema não consegue confirmar sozinho. */
export function pagaNaRetirada(metodo: string | null): boolean {
  return metodo === "dinheiro" || metodo === "maquininha";
}

/**
 * O que pode virar o quê.
 * Evita retrocesso acidental (marcar como pendente um pedido entregue)
 * e deixa claro na interface qual é o próximo passo natural.
 *
 * "devolvido" não está em nenhuma lista de destino: ele é escrito
 * pela Edge Function de reembolso, quando o dinheiro realmente volta.
 */
/** Vai buscar no balcão: não tem endereço de entrega. */
export function ehRetirada(p: { endereco_entrega: unknown | null }): boolean {
  return p.endereco_entrega === null;
}

/**
 * A esteira da entrega, que é diferente para quem retira.
 *
 * Quem busca na loja nunca passa por "enviado" — não há o que enviar.
 * E quem recebe em casa nunca passa por "pronto para retirada". Eram
 * esses dois passos que faltavam: antes o pedido pulava de pago
 * direto para enviado, e o lojista não tinha onde dizer que estava
 * separando.
 */
export function fluxoEntrega(p: { endereco_entrega: unknown | null }): StatusEntrega[] {
  return ehRetirada(p)
    ? ["a_separar", "separando", "pronto_retirada", "entregue"]
    : ["a_separar", "separando", "enviado", "entregue"];
}

/**
 * Para onde este pedido pode ir a partir de onde está.
 *
 * Só para a frente. Voltar atrás existe, mas é correção — passa por
 * corrigirEntrega, que é um caminho separado de propósito: avançar é
 * rotina, voltar é conserto.
 */
export function proximasEntregas(p: {
  endereco_entrega: unknown | null;
  status_entrega: StatusEntrega;
  situacao: Situacao;
}): StatusEntrega[] {
  if (p.situacao === "cancelada") return [];
  const fluxo = fluxoEntrega(p);
  const i = fluxo.indexOf(p.status_entrega);
  return i < 0 ? [] : fluxo.slice(i + 1);
}

/** Está esperando o lojista fazer alguma coisa. */
export function esperandoALoja(p: {
  situacao: Situacao;
  status_pagamento: StatusPagamento;
  status_entrega: StatusEntrega;
}): boolean {
  return (
    p.situacao === "ativa" &&
    p.status_entrega !== "entregue" &&
    (p.status_pagamento === "pago" || p.status_pagamento === "na_retirada")
  );
}

/**
 * Carrinho abandonado: nunca pagou e não vai pagar no balcão.
 *
 * O prazo existe porque um Pix recém-criado também está "pendente" —
 * e esse ainda pode ser pago nos próximos minutos. Um dia depois,
 * não é mais espera: é carrinho largado.
 */
export function ehAbandonado(p: {
  situacao: Situacao;
  status_pagamento: StatusPagamento;
  created_at: string;
}): boolean {
  if (p.situacao !== "ativa" || p.status_pagamento !== "pendente") return false;
  const umDia = 24 * 60 * 60 * 1000;
  return Date.now() - new Date(p.created_at).getTime() > umDia;
}

export const MOTIVOS_DEVOLUCAO: { valor: string; rotulo: string }[] = [
  { valor: "requested_by_customer", rotulo: "Cliente pediu / desistiu" },
  { valor: "duplicate", rotulo: "Compra duplicada" },
  { valor: "fraudulent", rotulo: "Suspeita de fraude" },
];

const CAMPOS = `
  id, numero, status, status_pagamento, status_entrega, situacao, visto_em,
  total, frete, metodo_pagamento, troco_para, created_at,
  endereco_entrega, cep_entrega,
  frete_transportadora, frete_prazo_dias, frete_servico,
  codigo_rastreio, etiqueta_url, etiqueta_status, melhor_envio_order_id,
  valor_reembolsado, reembolsado_em, motivo_reembolso,
  observacoes_internas,
  customers(nome, telefone, email, cpf),
  payments(cartao_tipo, cartao_bandeira, cartao_final, status, created_at),
  order_items(
    id, nome_produto, quantidade, preco_unitario, subtotal,
    cor_selecionada, tamanho_selecionado
  )
`;

function montar(o: any): Pedido {
  return {
    id: o.id,
    numero: String(o.numero ?? ""),
    status: (o.status ?? "pendente") as StatusPedido,
    status_pagamento: (o.status_pagamento ?? "pendente") as StatusPagamento,
    status_entrega: (o.status_entrega ?? "a_separar") as StatusEntrega,
    situacao: (o.situacao ?? "ativa") as Situacao,
    visto_em: o.visto_em ?? null,
    total: Number(o.total ?? 0),
    frete: Number(o.frete ?? 0),
    metodo_pagamento: o.metodo_pagamento ?? null,
    troco_para: o.troco_para === null || o.troco_para === undefined
      ? null
      : Number(o.troco_para),
    created_at: o.created_at,

    cliente_nome: o.customers?.nome ?? null,
    cliente_telefone: o.customers?.telefone ?? null,
    cliente_email: o.customers?.email ?? null,
    cliente_cpf: o.customers?.cpf ?? null,

    endereco_entrega: o.endereco_entrega ?? null,
    cep_entrega: o.cep_entrega ?? null,
    frete_transportadora: o.frete_transportadora ?? null,
    frete_prazo_dias: o.frete_prazo_dias ?? null,
    frete_servico: o.frete_servico ?? null,

    codigo_rastreio: o.codigo_rastreio ?? null,
    etiqueta_url: o.etiqueta_url ?? null,
    etiqueta_status: o.etiqueta_status ?? null,
    melhor_envio_order_id: o.melhor_envio_order_id ?? null,

    valor_reembolsado: Number(o.valor_reembolsado ?? 0),
    reembolsado_em: o.reembolsado_em ?? null,
    motivo_reembolso: o.motivo_reembolso ?? null,

    observacoes_internas: o.observacoes_internas ?? null,

    ...(() => {
      // Um pedido pode ter mais de uma tentativa de cobrança; a que
      // vale é a que foi recebida. Sem nenhuma recebida, fica a última.
      const pagamentos = (o.payments ?? []) as any[];
      const valendo =
        pagamentos.find((p) => p.status === "recebido") ??
        pagamentos[pagamentos.length - 1] ??
        null;

      return {
        cartao_tipo: valendo?.cartao_tipo ?? null,
        cartao_bandeira: valendo?.cartao_bandeira ?? null,
        cartao_final: valendo?.cartao_final ?? null,
      };
    })(),

    itens: (o.order_items ?? []).map((i: any) => ({
      id: i.id,
      nome_produto: i.nome_produto,
      quantidade: Number(i.quantidade ?? 0),
      preco_unitario: Number(i.preco_unitario ?? 0),
      subtotal: Number(i.subtotal ?? 0),
      cor_selecionada: i.cor_selecionada ?? null,
      tamanho_selecionado: i.tamanho_selecionado ?? null,
    })),
  };
}

export async function listarPedidos(): Promise<Pedido[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("orders")
    .select(CAMPOS)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(montar);
}

/**
 * Pedidos de um cliente, do mais recente para o mais antigo.
 *
 * Usa a mesma forma de `Pedido` da lista principal para a tela de
 * clientes reaproveitar a mesma leitura de itens e status — duas
 * versões do mesmo dado acabam divergindo.
 */
export async function listarPedidosDoCliente(
  clienteId: string
): Promise<Pedido[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("orders")
    .select(CAMPOS)
    .eq("store_id", storeId)
    .eq("customer_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(montar);
}

/**
 * Relê um pedido só. Usado depois de gerar etiqueta ou reembolsar,
 * para atualizar a tela aberta sem recarregar a lista inteira.
 */
export async function buscarPedido(pedidoId: string): Promise<Pedido | null> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("orders")
    .select(CAMPOS)
    .eq("id", pedidoId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw error;
  return data ? montar(data) : null;
}

/**
 * Muda o status de um pedido.
 *
 * A transição é validada aqui e o RLS garante que o pedido é mesmo
 * da loja de quem está pedindo — um `update` em pedido de outra loja
 * não encontra a linha e não altera nada.
 */
/**
 * Avança a entrega para o próximo passo.
 *
 * Substituiu a antiga atualizarStatusPedido, que escrevia no campo
 * único. A conferência de caminho válido continua aqui, e não só na
 * tela: a tela esconde o que não cabe, mas quem chama a API não é
 * obrigado a passar por ela.
 */
export async function avancarEntrega(
  pedido: {
    id: string;
    endereco_entrega: unknown | null;
    status_entrega: StatusEntrega;
    situacao: Situacao;
  },
  novo: StatusEntrega,
): Promise<void> {
  if (!proximasEntregas(pedido).includes(novo)) {
    throw new Error(
      `Não dá para ir de "${ROTULO_ENTREGA[pedido.status_entrega]}" para "${ROTULO_ENTREGA[novo]}".`,
    );
  }

  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ status_entrega: novo })
    .eq("id", pedido.id)
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Conserta a etapa de entrega, inclusive para trás.
 *
 * Separado de avancarEntrega de propósito: avançar é rotina e segue a
 * esteira; voltar é conserto de engano, e merece um caminho próprio
 * para não acontecer sem querer num toque errado.
 */
export async function corrigirEntrega(
  pedidoId: string,
  etapa: StatusEntrega,
): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ status_entrega: etapa })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Registra que o dinheiro entrou.
 *
 * É o que fecha o pedido do balcão: o sistema não tem como saber que
 * a nota trocou de mão, então quem diz é o lojista. Vale também para
 * acertar um Pix que caiu e o aviso automático não chegou.
 */
export async function marcarPagamentoRecebido(pedidoId: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ status_pagamento: "pago" })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/** Cancela o pedido. Não mexe no dinheiro — devolução é à parte. */
export async function cancelarPedido(pedidoId: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ situacao: "cancelada" })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/** Desfaz o cancelamento. */
export async function reativarPedido(pedidoId: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ situacao: "ativa" })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Marca o pedido como lido.
 *
 * Só escreve na primeira vez: sem o filtro, reabrir um pedido antigo
 * atualizaria a data e o "visto em" deixaria de significar quando o
 * lojista tomou conhecimento dele.
 */
export async function marcarComoVisto(pedidoId: string): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ visto_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("store_id", storeId)
    .is("visto_em", null);

  if (error) throw error;
}

/** Marca todos como lidos de uma vez. */
export async function marcarTodosComoVistos(): Promise<void> {
  const storeId = await getCurrentStoreId();
  const { error } = await supabase
    .from("orders")
    .update({ visto_em: new Date().toISOString() })
    .eq("store_id", storeId)
    .is("visto_em", null);

  if (error) throw error;
}

export async function salvarObservacoes(
  pedidoId: string,
  texto: string,
): Promise<void> {
  const storeId = await getCurrentStoreId();
  const limpo = texto.trim().slice(0, 2000);

  const { error } = await supabase
    .from("orders")
    .update({ observacoes_internas: limpo === "" ? null : limpo })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

/**
 * Código de rastreio digitado à mão.
 * Serve para quem posta pelos Correios no balcão, sem passar
 * pelo Melhor Envio.
 */
export async function salvarCodigoRastreio(
  pedidoId: string,
  codigo: string,
): Promise<void> {
  const storeId = await getCurrentStoreId();
  const limpo = codigo.trim().toUpperCase().slice(0, 60);

  const { error } = await supabase
    .from("orders")
    .update({ codigo_rastreio: limpo === "" ? null : limpo })
    .eq("id", pedidoId)
    .eq("store_id", storeId);

  if (error) throw error;
}

export interface ResultadoReembolso {
  sucesso: boolean;
  refundId: string;
  valorDevolvido: number;
  totalDevolvido: boolean;
  valorReembolsadoAcumulado: number;
}

/**
 * Devolve dinheiro ao cliente.
 *
 * Nada disso acontece aqui no navegador: o front só pede. Quem
 * confere se o pedido é seu, se o valor cabe e quem fala com a
 * Stripe é a Edge Function `stripe-reembolso` — que roda no
 * servidor, com a chave secreta que o navegador nunca vê.
 *
 * @param valor  em reais. Omitido = devolve tudo o que ainda resta.
 */
export async function reembolsarPedido(
  pedidoId: string,
  valor?: number,
  motivo?: string,
): Promise<ResultadoReembolso> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const url = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${url}/functions/v1/stripe-reembolso`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId: pedidoId, valor, motivo }),
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Falha na devolução (${res.status}).`);
  }

  return corpo as ResultadoReembolso;
}

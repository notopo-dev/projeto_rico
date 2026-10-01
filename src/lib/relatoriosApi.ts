import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Relatórios de vendas.
 *
 * ----------------------------------------------------------------
 * Isolamento entre lojas
 * ----------------------------------------------------------------
 * Toda consulta aqui filtra por store_id, mas esse filtro é
 * conveniência, NÃO é a proteção. Quem impede uma loja de ler dados
 * de outra é o RLS do banco (ver 03_rls_relatorios.sql): mesmo que
 * alguém altere o JavaScript no navegador e peça outro store_id, o
 * Postgres devolve vazio.
 *
 * Em `order_items` usamos `orders!inner(...)` com filtro no pedido —
 * isso força o join e faz o RLS de `orders` valer para os itens
 * também.
 * ----------------------------------------------------------------
 */

export type Periodo = "7d" | "30d" | "90d" | "12m";

export interface ResumoVendas {
  receita: number;
  receitaAnterior: number;
  pedidos: number;
  pedidosAnterior: number;
  ticketMedio: number;
  ticketMedioAnterior: number;
  itensVendidos: number;
  itensVendidosAnterior: number;
}

export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

export interface LinhaProduto {
  nome: string;
  sku: string;
  unidades: number;
  receita: number;
}

export interface LinhaPagamento {
  metodo: string;
  pedidos: number;
  receita: number;
}

export interface LinhaCliente {
  nome: string;
  pedidos: number;
  receita: number;
  ultimaCompra: string | null;
}

const NOMES_METODO: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  cartao_stripe: "Cartão",
  card: "Cartão",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  whatsapp: "Combinado no WhatsApp",
};

/**
 * Crédito e débito viram linhas separadas no relatório.
 *
 * Para a Stripe os dois são o mesmo tipo de pagamento — quem separa é
 * o BIN do cartão, que ela lê no momento da cobrança e o webhook grava
 * em `payments.cartao_tipo`. É por isso que o relatório olha ali, e
 * não para o que o cliente escolheu na tela: essa parte da informação
 * não existe na hora do checkout.
 *
 * Pedido antigo, de antes desse registro, continua como "Cartão".
 */
const NOMES_CARTAO: Record<string, string> = {
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  prepaid: "Cartão pré-pago",
};

const DIAS_POR_PERIODO: Record<Periodo, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

/**
 * O que conta como venda.
 *
 * Antes era "tudo que não está cancelado nem devolvido" — e isso
 * incluía o carrinho abandonado. Numa base real de testes, 21 dos 24
 * pedidos contados como receita eram pessoas que fecharam a aba sem
 * pagar: o faturamento aparecia quase vinte vezes maior do que era.
 *
 * Agora conta só o que foi pago de verdade. Pedido de balcão entra
 * quando o lojista registra que recebeu, que é quando o dinheiro
 * existe — nem antes, nem nunca.
 */
function contaComoVenda(o: { status_pagamento?: string | null }): boolean {
  return o.status_pagamento === "pago";
}

/**
 * Receita de um pedido, já descontado o que foi devolvido ao cliente.
 *
 * Um pedido reembolsado por inteiro some do relatório (status
 * "devolvido", acima). O parcial continua contando — mas só pelo que
 * de fato ficou com o lojista, senão o faturamento infla sozinho.
 */
function liquido(o: any) {
  return Number(o.total ?? 0) - Number(o.valor_reembolsado ?? 0);
}

function intervalo(periodo: Periodo) {
  const dias = DIAS_POR_PERIODO[periodo];

  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  inicio.setHours(0, 0, 0, 0);

  // Mesmo tamanho de janela, imediatamente antes — é com isto que
  // comparamos para mostrar a variação.
  const inicioAnterior = new Date(inicio);
  inicioAnterior.setDate(inicioAnterior.getDate() - dias);

  return { inicio, fim, inicioAnterior };
}

/** Números do topo, com comparação contra o período anterior. */
export async function getResumoVendas(
  periodo: Periodo
): Promise<ResumoVendas> {
  const storeId = await getCurrentStoreId();
  const { inicio, inicioAnterior } = intervalo(periodo);

  const { data, error } = await supabase
    .from("orders")
    .select("total, valor_reembolsado, created_at, status, status_pagamento, order_items(quantidade)")
    .eq("store_id", storeId)
    .gte("created_at", inicioAnterior.toISOString());

  if (error) throw error;

  const validos = (data ?? []).filter(
    (o: any) => contaComoVenda(o)
  );

  const atuais = validos.filter(
    (o: any) => new Date(o.created_at) >= inicio
  );
  const anteriores = validos.filter(
    (o: any) => new Date(o.created_at) < inicio
  );

  function somar(lista: any[]) {
    const receita = lista.reduce((s, o) => s + liquido(o), 0);
    const itens = lista.reduce(
      (s, o) =>
        s +
        (o.order_items ?? []).reduce(
          (t: number, i: any) => t + Number(i.quantidade ?? 0),
          0
        ),
      0
    );
    return {
      receita,
      pedidos: lista.length,
      itens,
      ticket: lista.length ? receita / lista.length : 0,
    };
  }

  const a = somar(atuais);
  const b = somar(anteriores);

  return {
    receita: a.receita,
    receitaAnterior: b.receita,
    pedidos: a.pedidos,
    pedidosAnterior: b.pedidos,
    ticketMedio: a.ticket,
    ticketMedioAnterior: b.ticket,
    itensVendidos: a.itens,
    itensVendidosAnterior: b.itens,
  };
}

/** Receita por dia (ou por mês, no período de 12 meses). */
export async function getReceitaPorPeriodo(
  periodo: Periodo
): Promise<PontoGrafico[]> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);
  const porMes = periodo === "12m";

  const { data, error } = await supabase
    .from("orders")
    .select("total, valor_reembolsado, created_at, status, status_pagamento")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString())
    .order("created_at");

  if (error) throw error;

  const baldes = new Map<string, number>();

  // Cria os baldes vazios primeiro: dia sem venda tem que aparecer
  // como zero no gráfico, não sumir.
  if (porMes) {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      baldes.set(
        d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        0
      );
    }
  } else {
    const dias = DIAS_POR_PERIODO[periodo];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      baldes.set(
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        0
      );
    }
  }

  (data ?? [])
    .filter((o: any) => contaComoVenda(o))
    .forEach((o: any) => {
      const d = new Date(o.created_at);
      const chave = porMes
        ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      if (baldes.has(chave)) {
        baldes.set(chave, (baldes.get(chave) ?? 0) + liquido(o));
      }
    });

  return Array.from(baldes.entries()).map(([rotulo, valor]) => ({
    rotulo,
    valor,
  }));
}

/** Ranking de produtos por unidades vendidas. */
export async function getProdutosVendidos(
  periodo: Periodo,
  limite = 10
): Promise<LinhaProduto[]> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  // O !inner força o join com orders — é o que faz o RLS de orders
  // valer aqui e impede ler itens de pedidos de outra loja.
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "quantidade, subtotal, nome_produto, product_id, orders!inner(store_id, status, status_pagamento, created_at), products(sku)"
    )
    .eq("orders.store_id", storeId)
    .gte("orders.created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaProduto>();

  (data ?? [])
    .filter((i: any) => contaComoVenda(i.orders ?? {}))
    .forEach((item: any) => {
      const chave = item.product_id ?? item.nome_produto;
      const atual = mapa.get(chave) ?? {
        nome: item.nome_produto ?? "Produto removido",
        sku: item.products?.sku ?? "—",
        unidades: 0,
        receita: 0,
      };
      atual.unidades += Number(item.quantidade ?? 0);
      atual.receita += Number(item.subtotal ?? 0);
      mapa.set(chave, atual);
    });

  return Array.from(mapa.values())
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limite);
}

/** Quanto entrou por forma de pagamento. */
export async function getVendasPorPagamento(
  periodo: Periodo
): Promise<LinhaPagamento[]> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "total, valor_reembolsado, metodo_pagamento, status, status_pagamento, payments(cartao_tipo, status)"
    )
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaPagamento>();

  (data ?? [])
    .filter((o: any) => contaComoVenda(o))
    .forEach((o: any) => {
      const bruto = o.metodo_pagamento ?? "outro";

      // Um pedido pode ter mais de uma tentativa; vale a recebida.
      const pagamentos = (o.payments ?? []) as any[];
      const valendo =
        pagamentos.find((p) => p.status === "recebido") ??
        pagamentos[pagamentos.length - 1] ??
        null;

      const metodo =
        (valendo?.cartao_tipo && NOMES_CARTAO[valendo.cartao_tipo]) ||
        NOMES_METODO[bruto] ||
        bruto;
      const atual = mapa.get(metodo) ?? { metodo, pedidos: 0, receita: 0 };
      atual.pedidos += 1;
      atual.receita += liquido(o);
      mapa.set(metodo, atual);
    });

  return Array.from(mapa.values()).sort((a, b) => b.receita - a.receita);
}

/** Clientes que mais compraram no período. */
export async function getMelhoresClientes(
  periodo: Periodo,
  limite = 10
): Promise<LinhaCliente[]> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  const { data, error } = await supabase
    .from("orders")
    .select("total, valor_reembolsado, created_at, status, status_pagamento, customer_id, customers(nome)")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaCliente>();

  (data ?? [])
    .filter((o: any) => contaComoVenda(o))
    .forEach((o: any) => {
      const chave = o.customer_id ?? "sem-cadastro";
      const atual = mapa.get(chave) ?? {
        nome: o.customers?.nome ?? "Cliente sem cadastro",
        pedidos: 0,
        receita: 0,
        ultimaCompra: null as string | null,
      };
      atual.pedidos += 1;
      atual.receita += liquido(o);

      const data = new Date(o.created_at).toISOString();
      if (!atual.ultimaCompra || data > atual.ultimaCompra) {
        atual.ultimaCompra = data;
      }
      mapa.set(chave, atual);
    });

  return Array.from(mapa.values())
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limite);
}

// ==================================================================
// RELATÓRIOS ADICIONADOS
//
// Os três que 4 ou 5 das 5 maiores plataformas brasileiras oferecem e
// que faltavam aqui: região, novos vs. recorrentes e custo de frete.
//
// Tudo abaixo é ADIÇÃO. Nenhuma função, tipo ou consulta acima foi
// alterada — os relatórios que já funcionavam continuam com as mesmas
// consultas de antes.
//
// Todas as consultas reaproveitam intervalo(), liquido() e
// contaComoVenda(), para que o que entra no faturamento seja o mesmo
// em todo relatório. Relatório que conta diferente do vizinho é pior
// do que relatório que falta.
// ==================================================================

export interface LinhaRegiao {
  uf: string;
  pedidos: number;
  receita: number;
}

/**
 * Vendas por estado.
 *
 * Lê a UF do endereço de ENTREGA gravado no pedido, não o endereço
 * atual do cliente: o pedido é uma fotografia do que foi combinado
 * naquele dia, e cliente muda de endereço.
 */
export async function getVendasPorRegiao(
  periodo: Periodo,
  limite = 10,
): Promise<LinhaRegiao[]> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  const { data, error } = await supabase
    .from("orders")
    .select("total, valor_reembolsado, status, status_pagamento, endereco_entrega")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaRegiao>();

  (data ?? [])
    .filter((o: any) => contaComoVenda(o))
    .forEach((o: any) => {
      const bruta = o.endereco_entrega?.uf;
      // Pedido sem UF entra como "Não informado" em vez de ser
      // descartado: a soma das linhas tem de fechar com o
      // faturamento do topo, senão o lojista acha que falta dinheiro.
      const uf =
        typeof bruta === "string" && bruta.trim()
          ? bruta.trim().toUpperCase().slice(0, 2)
          : "Não informado";

      const atual = mapa.get(uf) ?? { uf, pedidos: 0, receita: 0 };
      atual.pedidos += 1;
      atual.receita += liquido(o);
      mapa.set(uf, atual);
    });

  return Array.from(mapa.values())
    .sort((a, b) => b.receita - a.receita)
    .slice(0, limite);
}

export interface ClientesNovosRecorrentes {
  novos: number;
  recorrentes: number;
  receitaNovos: number;
  receitaRecorrentes: number;
  /** Compradores sem cadastro: não dá para saber se voltaram. */
  semCadastro: number;
}

/**
 * Clientes novos contra clientes que voltaram.
 *
 * "Novo" é quem não tinha pedido nenhum ANTES do início do período.
 * Isso se resolve em duas consultas, não em uma por cliente: a
 * segunda pergunta de uma vez quais daqueles clientes já apareciam
 * antes. Com uma consulta por cliente, uma loja com 300 compradores
 * no mês faria 301 idas ao banco para desenhar um gráfico.
 */
export async function getClientesNovosRecorrentes(
  periodo: Periodo,
): Promise<ClientesNovosRecorrentes> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  const { data: doPeriodo, error } = await supabase
    .from("orders")
    .select("total, valor_reembolsado, status, status_pagamento, customer_id")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const validos = (doPeriodo ?? []).filter(
    (o: any) => contaComoVenda(o),
  );

  const ids = Array.from(
    new Set(
      validos
        .map((o: any) => o.customer_id)
        .filter((id: any): id is string => Boolean(id)),
    ),
  );

  // Quem já comprava antes desta janela.
  const jaCompravam = new Set<string>();
  if (ids.length > 0) {
    const { data: anteriores, error: erroAnteriores } = await supabase
      .from("orders")
      .select("customer_id")
      .eq("store_id", storeId)
      .lt("created_at", inicio.toISOString())
      .in("customer_id", ids);

    if (erroAnteriores) throw erroAnteriores;

    (anteriores ?? []).forEach((o: any) => {
      if (o.customer_id) jaCompravam.add(o.customer_id);
    });
  }

  const resultado: ClientesNovosRecorrentes = {
    novos: 0,
    recorrentes: 0,
    receitaNovos: 0,
    receitaRecorrentes: 0,
    semCadastro: 0,
  };

  // Um cliente conta UMA vez, mesmo com três pedidos no período —
  // senão "recorrentes" viraria contagem de pedido, não de gente.
  const contados = new Set<string>();

  validos.forEach((o: any) => {
    const valor = liquido(o);
    const id = o.customer_id;

    if (!id) {
      resultado.semCadastro += 1;
      return;
    }

    const recorrente = jaCompravam.has(id);
    if (recorrente) {
      resultado.receitaRecorrentes += valor;
    } else {
      resultado.receitaNovos += valor;
    }

    if (!contados.has(id)) {
      contados.add(id);
      if (recorrente) resultado.recorrentes += 1;
      else resultado.novos += 1;
    }
  });

  return resultado;
}

export interface ResumoFrete {
  totalCobrado: number;
  pedidosComFrete: number;
  pedidosFreteGratis: number;
  freteMedio: number;
  porTransportadora: { nome: string; pedidos: number; total: number }[];
}

/**
 * Quanto de frete entrou e quantos pedidos saíram de graça.
 *
 * Importante para não ler errado: `frete` é o que o CLIENTE pagou,
 * não o que a transportadora cobrou do lojista. O custo real da
 * etiqueta não está no banco hoje. Por isso o rótulo na tela diz
 * "frete cobrado" e não "custo de frete" — prometer margem de frete
 * com esse número seria inventar.
 */
export async function getResumoFrete(periodo: Periodo): Promise<ResumoFrete> {
  const storeId = await getCurrentStoreId();
  const { inicio } = intervalo(periodo);

  const { data, error } = await supabase
    .from("orders")
    .select("frete, status, status_pagamento, frete_transportadora, frete_servico")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const validos = (data ?? []).filter(
    (o: any) => contaComoVenda(o),
  );

  const mapa = new Map<string, { nome: string; pedidos: number; total: number }>();
  let totalCobrado = 0;
  let pedidosComFrete = 0;
  let pedidosFreteGratis = 0;

  validos.forEach((o: any) => {
    const frete = Number(o.frete ?? 0);
    totalCobrado += frete;
    if (frete > 0) pedidosComFrete += 1;
    else pedidosFreteGratis += 1;

    const nome =
      o.frete_transportadora?.trim() ||
      o.frete_servico?.trim() ||
      "Não informado";
    const atual = mapa.get(nome) ?? { nome, pedidos: 0, total: 0 };
    atual.pedidos += 1;
    atual.total += frete;
    mapa.set(nome, atual);
  });

  return {
    totalCobrado,
    pedidosComFrete,
    pedidosFreteGratis,
    // Média sobre quem pagou frete. Incluir os gratuitos puxaria a
    // média para baixo e faria o número não querer dizer nada.
    freteMedio: pedidosComFrete > 0 ? totalCobrado / pedidosComFrete : 0,
    porTransportadora: Array.from(mapa.values()).sort(
      (a, b) => b.pedidos - a.pedidos,
    ),
  };
}

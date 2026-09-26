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
  cartao_stripe: "Cartão",
  card: "Cartão",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  whatsapp: "Combinado no WhatsApp",
};

const DIAS_POR_PERIODO: Record<Periodo, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

/** Status que não contam como venda realizada. */
const STATUS_IGNORADOS = ["cancelado"];

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
    .select("total, created_at, status, order_items(quantidade)")
    .eq("store_id", storeId)
    .gte("created_at", inicioAnterior.toISOString());

  if (error) throw error;

  const validos = (data ?? []).filter(
    (o: any) => !STATUS_IGNORADOS.includes(o.status)
  );

  const atuais = validos.filter(
    (o: any) => new Date(o.created_at) >= inicio
  );
  const anteriores = validos.filter(
    (o: any) => new Date(o.created_at) < inicio
  );

  function somar(lista: any[]) {
    const receita = lista.reduce((s, o) => s + Number(o.total ?? 0), 0);
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
    .select("total, created_at, status")
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
    .filter((o: any) => !STATUS_IGNORADOS.includes(o.status))
    .forEach((o: any) => {
      const d = new Date(o.created_at);
      const chave = porMes
        ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      if (baldes.has(chave)) {
        baldes.set(chave, (baldes.get(chave) ?? 0) + Number(o.total ?? 0));
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
      "quantidade, subtotal, nome_produto, product_id, orders!inner(store_id, status, created_at), products(sku)"
    )
    .eq("orders.store_id", storeId)
    .gte("orders.created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaProduto>();

  (data ?? [])
    .filter((i: any) => !STATUS_IGNORADOS.includes(i.orders?.status))
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
    .select("total, metodo_pagamento, status")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaPagamento>();

  (data ?? [])
    .filter((o: any) => !STATUS_IGNORADOS.includes(o.status))
    .forEach((o: any) => {
      const bruto = o.metodo_pagamento ?? "outro";
      const metodo = NOMES_METODO[bruto] ?? bruto;
      const atual = mapa.get(metodo) ?? { metodo, pedidos: 0, receita: 0 };
      atual.pedidos += 1;
      atual.receita += Number(o.total ?? 0);
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
    .select("total, created_at, status, customer_id, customers(nome)")
    .eq("store_id", storeId)
    .gte("created_at", inicio.toISOString());

  if (error) throw error;

  const mapa = new Map<string, LinhaCliente>();

  (data ?? [])
    .filter((o: any) => !STATUS_IGNORADOS.includes(o.status))
    .forEach((o: any) => {
      const chave = o.customer_id ?? "sem-cadastro";
      const atual = mapa.get(chave) ?? {
        nome: o.customers?.nome ?? "Cliente sem cadastro",
        pedidos: 0,
        receita: 0,
        ultimaCompra: null as string | null,
      };
      atual.pedidos += 1;
      atual.receita += Number(o.total ?? 0);

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

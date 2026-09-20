import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

export interface DashboardStats {
  vendasHoje: number;
  vendasOntem: number;
  pedidosHoje: number;
  pedidosOntem: number;
  clientesAtivos: number;
  clientesAtivosMesPassado: number;
  produtosAtivos: number;
}

export interface VendaPorDia {
  day: string;
  vendas: number;
}

export interface PedidoRecente {
  id: string;
  cliente: string;
  produto: string;
  valor: string;
  status: string;
  data: string;
}

export interface ProdutoMaisVendido {
  nome: string;
  sku: string;
  vendas: number;
  receita: string;
  estoque: number;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function inicioDoDia(d: Date) {
  const novo = new Date(d);
  novo.setHours(0, 0, 0, 0);
  return novo;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusMap: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const storeId = await getCurrentStoreId();

  const hoje = inicioDoDia(new Date());
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const sessentaDiasAtras = new Date(hoje);
  sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60);

  const [
    pedidosHojeRes,
    pedidosOntemRes,
    clientesAtivosRes,
    clientesAtivosMesPassadoRes,
    produtosAtivosRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("total, status")
      .eq("store_id", storeId)
      .gte("created_at", hoje.toISOString())
      .lt("created_at", amanha.toISOString()),
    supabase
      .from("orders")
      .select("total, status")
      .eq("store_id", storeId)
      .gte("created_at", ontem.toISOString())
      .lt("created_at", hoje.toISOString()),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", trintaDiasAtras.toISOString()),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", sessentaDiasAtras.toISOString())
      .lt("created_at", trintaDiasAtras.toISOString()),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "ativo"),
  ]);

  const pedidosHoje = pedidosHojeRes.data ?? [];
  const pedidosOntem = pedidosOntemRes.data ?? [];

  const vendasHoje = pedidosHoje
    .filter((p) => p.status !== "cancelado")
    .reduce((sum, p) => sum + Number(p.total), 0);
  const vendasOntem = pedidosOntem
    .filter((p) => p.status !== "cancelado")
    .reduce((sum, p) => sum + Number(p.total), 0);

  return {
    vendasHoje,
    vendasOntem,
    pedidosHoje: pedidosHoje.length,
    pedidosOntem: pedidosOntem.length,
    clientesAtivos: clientesAtivosRes.count ?? 0,
    clientesAtivosMesPassado: clientesAtivosMesPassadoRes.count ?? 0,
    produtosAtivos: produtosAtivosRes.count ?? 0,
  };
}

export async function getVendasUltimos7Dias(): Promise<VendaPorDia[]> {
  const storeId = await getCurrentStoreId();

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);
  seteDiasAtras.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("orders")
    .select("total, created_at, status")
    .eq("store_id", storeId)
    .neq("status", "cancelado")
    .gte("created_at", seteDiasAtras.toISOString())
    .order("created_at");

  if (error) throw error;

  const porDia = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(seteDiasAtras);
    d.setDate(d.getDate() + i);
    porDia.set(d.toDateString(), 0);
  }

  (data ?? []).forEach((pedido) => {
    const dia = new Date(pedido.created_at).toDateString();
    if (porDia.has(dia)) {
      porDia.set(dia, (porDia.get(dia) ?? 0) + Number(pedido.total));
    }
  });

  return Array.from(porDia.entries()).map(([diaStr, vendas]) => {
    const data = new Date(diaStr);
    return { day: DIAS_SEMANA[data.getDay()], vendas };
  });
}

export async function getPedidosRecentes(limite = 5): Promise<PedidoRecente[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "numero, total, status, created_at, customers(nome), order_items(nome_produto)"
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw error;

  return (data ?? []).map((o: any) => ({
    id: `#${o.numero}`,
    cliente: o.customers?.nome ?? "Cliente",
    produto:
      o.order_items?.length > 1
        ? `${o.order_items[0]?.nome_produto} +${o.order_items.length - 1}`
        : o.order_items?.[0]?.nome_produto ?? "—",
    valor: formatBRL(Number(o.total)),
    status: statusMap[o.status] ?? o.status,
    data: new Date(o.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getProdutosMaisVendidos(
  limite = 4
): Promise<ProdutoMaisVendido[]> {
  const storeId = await getCurrentStoreId();

  // Junta order_items com orders (para filtrar por loja e status)
  // e products (para nome/sku/estoque atuais).
  const { data, error } = await supabase
    .from("order_items")
    .select(
      "quantidade, subtotal, product_id, nome_produto, orders!inner(store_id, status), products(sku, estoque)"
    )
    .eq("orders.store_id", storeId)
    .neq("orders.status", "cancelado");

  if (error) throw error;

  const porProduto = new Map<
    string,
    { nome: string; sku: string; vendas: number; receita: number; estoque: number }
  >();

  (data ?? []).forEach((item: any) => {
    const key = item.product_id ?? item.nome_produto;
    const atual = porProduto.get(key) ?? {
      nome: item.nome_produto,
      sku: item.products?.sku ?? "—",
      vendas: 0,
      receita: 0,
      estoque: item.products?.estoque ?? 0,
    };
    atual.vendas += item.quantidade;
    atual.receita += Number(item.subtotal);
    porProduto.set(key, atual);
  });

  return Array.from(porProduto.values())
    .sort((a, b) => b.vendas - a.vendas)
    .slice(0, limite)
    .map((p) => ({
      nome: p.nome,
      sku: p.sku,
      vendas: p.vendas,
      receita: formatBRL(p.receita),
      estoque: p.estoque,
    }));
}
import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Users,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import Badge from "../components/Badge";
import {
  getDashboardStats,
  getVendasUltimos7Dias,
  getPedidosRecentes,
  getProdutosMaisVendidos,
  type VendaPorDia,
  type PedidoRecente,
  type ProdutoMaisVendido,
} from "../lib/dashboardApi";

// ============================================================
// STATUS
// ============================================================

const statusVariant: Record<
  string,
  "success" | "warning" | "error" | "neutral" | "info"
> = {
  Pago: "success",
  Pendente: "warning",
  Enviado: "info",
  Entregue: "neutral",
  Cancelado: "error",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatVariacao(atual: number, anterior: number) {
  if (anterior === 0) {
    return atual > 0 ? { texto: "novo", up: true } : { texto: "", up: true };
  }
  const pct = ((atual - anterior) / anterior) * 100;
  const sinal = pct >= 0 ? "+" : "";
  return {
    texto: `${sinal}${pct.toFixed(1)}%`,
    up: pct >= 0,
  };
}

// ============================================================
// DASHBOARD
// ============================================================

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [salesData, setSalesData] = useState<VendaPorDia[]>([]);
  const [recentOrders, setRecentOrders] = useState<PedidoRecente[]>([]);
  const [topProducts, setTopProducts] = useState<ProdutoMaisVendido[]>([]);
  const [stats, setStats] = useState([
    { label: "Vendas hoje", value: "R$ 0,00", change: "", up: true, icon: TrendingUp, sub: "" },
    { label: "Pedidos hoje", value: "0", change: "", up: true, icon: ShoppingBag, sub: "" },
    { label: "Clientes ativos", value: "0", change: "", up: true, icon: Users, sub: "últimos 30 dias" },
    { label: "Produtos ativos", value: "0", change: "", up: true, icon: Package, sub: "em catálogo" },
  ]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashStats, vendas, pedidos, produtos] = await Promise.all([
          getDashboardStats(),
          getVendasUltimos7Dias(),
          getPedidosRecentes(5),
          getProdutosMaisVendidos(4),
        ]);

        if (!mounted) return;

        const varVendas = formatVariacao(dashStats.vendasHoje, dashStats.vendasOntem);
        const varPedidos = formatVariacao(dashStats.pedidosHoje, dashStats.pedidosOntem);
        const varClientes = formatVariacao(
          dashStats.clientesAtivos,
          dashStats.clientesAtivosMesPassado
        );

        setStats([
          {
            label: "Vendas hoje",
            value: formatBRL(dashStats.vendasHoje),
            change: varVendas.texto,
            up: varVendas.up,
            icon: TrendingUp,
            sub: "vs. ontem",
          },
          {
            label: "Pedidos hoje",
            value: String(dashStats.pedidosHoje),
            change: varPedidos.texto,
            up: varPedidos.up,
            icon: ShoppingBag,
            sub: "vs. ontem",
          },
          {
            label: "Clientes novos",
            value: String(dashStats.clientesAtivos),
            change: varClientes.texto,
            up: varClientes.up,
            icon: Users,
            sub: "últimos 30 dias",
          },
          {
            label: "Produtos ativos",
            value: String(dashStats.produtosAtivos),
            change: "",
            up: true,
            icon: Package,
            sub: "em catálogo",
          },
        ]);

        setSalesData(vendas);
        setRecentOrders(pedidos);
        setTopProducts(produtos);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalSemana = salesData.reduce((sum, d) => sum + d.vendas, 0);

  return (
    <div className="w-full min-h-full mx-auto px-3 py-3 sm:px-4 sm:py-4 lg:max-w-[1200px] lg:px-6 lg:py-6 space-y-3 sm:space-y-4 overflow-x-hidden">
      {error && (
        <div
          role="alert"
          className="painel-app t-apoio border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-[#b91c1c]"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 t-apoio text-[#6b7280]">
          <Loader2 size={16} className="animate-spin" />
          Carregando dados...
        </div>
      )}

      {/* ======================================================
          INDICADORES

          Quatro números, não quatro cartões decorados. O ícone é
          de 16px ao lado do rótulo, sem pastilha cinza atrás: as
          diretrizes do projeto pedem ícone discreto, e a pastilha
          só existia para preencher espaço.
      ====================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {stats.map((s) => {
          const Icon = s.icon;

          return (
            <div key={s.label} className="painel-app min-w-0 px-3 py-3 sm:px-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  className="shrink-0 text-[#9ca3af]"
                />
                <span className="t-apoio text-[#6b7280] truncate">
                  {s.label}
                </span>
              </div>

              <p className="t-numero text-[#0f1117] truncate">{s.value}</p>

              {(s.change || s.sub) && (
                <div className="flex items-center gap-1 mt-1.5 min-w-0">
                  {s.change && (
                    <>
                      {s.up ? (
                        <ArrowUpRight
                          size={14}
                          strokeWidth={2}
                          className="shrink-0 text-[#16a34a]"
                        />
                      ) : (
                        <ArrowDownRight
                          size={14}
                          strokeWidth={2}
                          className="shrink-0 text-[#b91c1c]"
                        />
                      )}
                      <span
                        className={`t-micro font-semibold shrink-0 ${
                          s.up ? "text-[#16a34a]" : "text-[#b91c1c]"
                        }`}
                      >
                        {s.change}
                      </span>
                    </>
                  )}
                  <span className="t-micro text-[#9ca3af] truncate">
                    {s.sub}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ======================================================
          VENDAS DA SEMANA + MAIS VENDIDOS
      ====================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="painel-app lg:col-span-2 min-w-0 overflow-hidden">
          <div className="painel-topo">
            <span className="t-secao text-[#0f1117] truncate">
              Vendas — últimos 7 dias
            </span>
            {salesData.length > 0 && (
              <span className="t-apoio numeros text-[#6b7280] whitespace-nowrap">
                {formatBRL(totalSemana)} total
              </span>
            )}
          </div>

          <div className="px-2 py-3 sm:p-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={salesData}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  width={44}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />

                <Tooltip
                  contentStyle={{
                    fontSize: 13,
                    border: "1px solid #e4e4e7",
                    borderRadius: 8,
                    boxShadow: "none",
                  }}
                  formatter={(v) => [formatBRL(Number(v)), "Vendas"]}
                />

                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                  fill="url(#salesGrad)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: "#16a34a" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="painel-app min-w-0 overflow-hidden">
          <div className="painel-topo">
            <span className="t-secao text-[#0f1117]">Mais vendidos</span>
          </div>

          <div className="lista-linhas">
            {topProducts.map((p, i) => (
              <div key={p.sku} className="linha-app">
                <span className="t-apoio numeros font-semibold text-[#9ca3af] w-4 shrink-0">
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="t-corpo font-medium text-[#0f1117] truncate">
                    {p.nome}
                  </p>
                  <p className="t-micro text-[#9ca3af]">{p.vendas} vendas</p>
                </div>

                <span className="t-corpo numeros font-semibold text-[#0f1117] whitespace-nowrap">
                  {p.receita}
                </span>
              </div>
            ))}

            {topProducts.length === 0 && !loading && (
              <p className="px-4 py-6 text-center t-apoio text-[#9ca3af]">
                Nenhuma venda registrada ainda.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          PEDIDOS RECENTES

          Tabela a partir de 640px; no celular, uma linha por
          pedido. As duas listam os mesmos campos — a tabela não
          esconde nada que o celular mostre, nem o contrário.
      ====================================================== */}
      <div className="painel-app overflow-hidden">
        <div className="painel-topo">
          <span className="t-secao text-[#0f1117]">Pedidos recentes</span>
        </div>

        <div className="hidden sm:block rolagem-tabela">
          <table className="tabela-app min-w-[600px]">
            <thead>
              <tr>
                {["Pedido", "Cliente", "Produto", "Valor", "Status", "Data"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold text-[#15803d] whitespace-nowrap">
                    {o.id}
                  </td>
                  <td className="text-[#0f1117]">{o.cliente}</td>
                  <td className="text-[#374151]">{o.produto}</td>
                  <td className="numeros font-semibold text-[#0f1117] whitespace-nowrap">
                    {o.valor}
                  </td>
                  <td>
                    <Badge
                      variant={statusVariant[o.status] || "neutral"}
                      label={o.status}
                    />
                  </td>
                  <td className="text-[#6b7280] whitespace-nowrap">{o.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden lista-linhas">
          {recentOrders.map((o) => (
            <div key={o.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="t-corpo font-semibold text-[#15803d]">
                  {o.id}
                </span>
                <Badge
                  variant={statusVariant[o.status] || "neutral"}
                  label={o.status}
                />
              </div>

              <div className="min-w-0">
                <p className="t-corpo text-[#0f1117] truncate">{o.cliente}</p>
                <p className="t-apoio text-[#6b7280] truncate mt-0.5">
                  {o.produto}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="t-micro text-[#9ca3af]">{o.data}</span>
                <span className="t-corpo numeros font-semibold text-[#0f1117]">
                  {o.valor}
                </span>
              </div>
            </div>
          ))}
        </div>

        {recentOrders.length === 0 && (
          <p className="px-4 py-8 text-center t-apoio text-[#9ca3af]">
            Nenhum pedido encontrado.
          </p>
        )}
      </div>
    </div>
  );
}

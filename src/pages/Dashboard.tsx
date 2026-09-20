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
    <div
      className="
        w-full
        min-h-full
        mx-auto

        px-3
        py-3

        sm:px-4
        sm:py-4

        lg:max-w-[1200px]
        lg:px-6
        lg:py-6

        space-y-3
        sm:space-y-4
        lg:space-y-6

        overflow-x-hidden
      "
    >
      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-[12px] text-[#b91c1c]">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <Loader2 size={14} className="animate-spin" />
          Carregando dados...
        </div>
      )}

      {/* ======================================================
          ESTATÍSTICAS
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-2

          gap-2

          sm:gap-3
          lg:gap-4
        "
      >
        {stats.map((s) => {
          const Icon = s.icon;

          return (
            <div
              key={s.label}
              className="
                min-w-0
                min-h-[92px]

                bg-white
                border
                border-[#e5e7eb]

                rounded-2xl

                px-3
                py-3

                sm:min-h-[100px]
                sm:p-4

                lg:rounded-[10px]

                shadow-[0_1px_3px_rgba(0,0,0,0.04)]
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-2

                  mb-2
                "
              >
                <span
                  className="
                    min-w-0

                    text-[10px]
                    sm:text-[12px]

                    text-[#6b7280]
                    font-medium

                    truncate
                  "
                >
                  {s.label}
                </span>

                <div
                  className="
                    shrink-0
                    w-7
                    h-7

                    sm:w-8
                    sm:h-8

                    rounded-xl

                    bg-[#f5f5f5]

                    flex
                    items-center
                    justify-center
                  "
                >
                  <Icon
                    size={14}
                    className="
                      sm:w-4
                      sm:h-4
                      text-[#6b7280]
                    "
                    strokeWidth={1.8}
                  />
                </div>
              </div>

              <p
                className="
                  text-[18px]
                  sm:text-[20px]

                  font-semibold
                  text-[#0f1117]

                  leading-none

                  mb-1.5

                  truncate
                "
              >
                {s.value}
              </p>

              <div
                className="
                  flex
                  items-center
                  gap-1

                  min-h-[14px]
                "
              >
                {s.change && (
                  <>
                    {s.up ? (
                      <ArrowUpRight
                        size={11}
                        className="
                          shrink-0
                          text-[#16a34a]
                        "
                        strokeWidth={2}
                      />
                    ) : (
                      <ArrowDownRight
                        size={11}
                        className="
                          shrink-0
                          text-[#b91c1c]
                        "
                        strokeWidth={2}
                      />
                    )}

                    <span
                      className={`
                        text-[9px]
                        sm:text-[11px]

                        font-medium
                        truncate

                        ${
                          s.up
                            ? "text-[#16a34a]"
                            : "text-[#b91c1c]"
                        }
                      `}
                    >
                      {s.change}
                    </span>
                  </>
                )}

                <span
                  className="
                    text-[9px]
                    sm:text-[11px]

                    text-[#9ca3af]

                    truncate
                  "
                >
                  {s.sub}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================================
          GRÁFICO + MAIS VENDIDOS
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-3

          gap-3
          sm:gap-4
        "
      >
        {/* ====================================================
            GRÁFICO
        ==================================================== */}

        <div
          className="
            lg:col-span-2

            min-w-0

            bg-white
            border
            border-[#e5e7eb]

            rounded-2xl
            lg:rounded-[10px]

            overflow-hidden

            shadow-[0_1px_3px_rgba(0,0,0,0.04)]
          "
        >
          <div
            className="
              px-3
              py-3

              sm:px-4

              border-b
              border-[#e5e7eb]

              flex
              items-center
              justify-between
              gap-2
            "
          >
            <span
              className="
                text-[12px]
                sm:text-[13px]

                font-semibold
                text-[#0f1117]

                truncate
              "
            >
              Vendas — últimos 7 dias
            </span>

            <span
              className="
                text-[9px]
                sm:text-[12px]

                text-[#6b7280]

                whitespace-nowrap
              "
            >
              {salesData.length > 0
                ? `R$ ${salesData
                    .reduce(
                      (total, item) =>
                        total + item.vendas,
                      0
                    )
                    .toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })} total`
                : ""}
            </span>
          </div>

          <div
            className="
              px-2
              py-2

              sm:p-4

              min-h-[190px]
            "
          >
            <ResponsiveContainer
              width="100%"
              height={180}
            >
              <AreaChart
                data={salesData}
                margin={{
                  top: 4,
                  right: 4,
                  bottom: 0,
                  left: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="salesGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#16a34a"
                      stopOpacity={0.12}
                    />

                    <stop
                      offset="95%"
                      stopColor="#16a34a"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  tick={{
                    fontSize: 10,
                    fill: "#9ca3af",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  width={38}
                  tick={{
                    fontSize: 10,
                    fill: "#9ca3af",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    `R$${(v / 1000).toFixed(0)}k`
                  }
                />

                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    border: "1px solid #e4e4e7",
                    borderRadius: 8,
                    boxShadow: "none",
                  }}
                  formatter={(v) => [
                    `R$ ${Number(v).toLocaleString(
                      "pt-BR",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}`,
                    "Vendas",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="#16a34a"
                  strokeWidth={1.5}
                  fill="url(#salesGrad)"
                  dot={false}
                  activeDot={{
                    r: 3,
                    strokeWidth: 0,
                    fill: "#16a34a",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ====================================================
            MAIS VENDIDOS
        ==================================================== */}

        <div
          className="
            min-w-0

            bg-white
            border
            border-[#e5e7eb]

            rounded-2xl
            lg:rounded-[10px]

            overflow-hidden

            shadow-[0_1px_3px_rgba(0,0,0,0.04)]
          "
        >
          <div
            className="
              px-3
              py-3

              sm:px-4

              border-b
              border-[#e5e7eb]
            "
          >
            <span
              className="
                text-[12px]
                sm:text-[13px]

                font-semibold
                text-[#0f1117]
              "
            >
              Mais vendidos
            </span>
          </div>

          <div className="divide-y divide-[#f4f4f5]">
            {topProducts.map((p, i) => (
              <div
                key={p.sku}
                className="
                  px-3
                  py-3

                  sm:px-4
                  sm:py-2.5

                  flex
                  items-center
                  gap-2.5
                  sm:gap-3
                "
              >
                <span
                  className="
                    text-[10px]
                    sm:text-[11px]

                    font-semibold
                    text-[#9ca3af]

                    w-4
                    shrink-0
                  "
                >
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className="
                      text-[11px]
                      sm:text-[12px]

                      font-medium
                      text-[#0f1117]

                      truncate
                    "
                  >
                    {p.nome}
                  </p>

                  <p
                    className="
                      text-[10px]
                      sm:text-[11px]

                      text-[#9ca3af]
                    "
                  >
                    {p.vendas} vendas
                  </p>
                </div>

                <span
                  className="
                    text-[11px]
                    sm:text-[12px]

                    font-semibold
                    text-[#0f1117]

                    whitespace-nowrap
                  "
                >
                  {p.receita}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================
          PEDIDOS RECENTES
      ====================================================== */}

      <div
        className="
          bg-white

          border
          border-[#e5e7eb]

          rounded-2xl
          lg:rounded-[10px]

          overflow-hidden

          shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        "
      >
        <div
          className="
            px-3
            py-3

            sm:px-4

            border-b
            border-[#e5e7eb]

            flex
            items-center
            justify-between
            gap-2
          "
        >
          <span
            className="
              text-[12px]
              sm:text-[13px]

              font-semibold
              text-[#0f1117]
            "
          >
            Pedidos recentes
          </span>

          <button
            type="button"
            className="
              text-[10px]
              sm:text-[12px]

              text-[#16a34a]

              font-medium
              whitespace-nowrap

              px-2
              py-1

              rounded-lg

              active:bg-[#f0fdf4]
              transition-colors
            "
          >
            Ver todos
          </button>
        </div>

        {/* ====================================================
            TABELA
            Mantida somente para telas maiores.
        ==================================================== */}

        <div className="hidden sm:block overflow-x-auto">
          <table
            className="
              w-full
              min-w-[600px]
            "
          >
            <thead>
              <tr
                className="
                  border-b
                  border-[#e5e7eb]

                  bg-[#fafafa]
                "
              >
                {[
                  "Pedido",
                  "Cliente",
                  "Produto",
                  "Valor",
                  "Status",
                  "Data",
                ].map((h) => (
                  <th
                    key={h}
                    className="
                      px-3
                      sm:px-4

                      py-2.5

                      text-left

                      text-[10px]
                      sm:text-[11px]

                      font-semibold
                      text-[#6b7280]

                      uppercase
                      tracking-wider
                    "
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {recentOrders.map((o) => (
                <tr
                  key={o.id}
                  className="
                    border-b
                    border-[#f4f4f5]

                    hover:bg-[#fafafa]

                    transition-colors
                  "
                >
                  <td
                    className="
                      px-3
                      sm:px-4

                      py-3

                      text-[11px]
                      sm:text-[12px]

                      font-medium
                      text-[#15803d]
                    "
                  >
                    {o.id}
                  </td>

                  <td
                    className="
                      px-3
                      sm:px-4

                      py-3

                      text-[11px]
                      sm:text-[12px]

                      text-[#0f1117]
                    "
                  >
                    {o.cliente}
                  </td>

                  <td
                    className="
                      px-3
                      sm:px-4

                      py-3

                      text-[11px]
                      sm:text-[12px]

                      text-[#374151]
                    "
                  >
                    {o.produto}
                  </td>

                  <td
                    className="
                      px-3
                      sm:px-4

                      py-3

                      text-[11px]
                      sm:text-[12px]

                      font-medium
                      text-[#0f1117]
                    "
                  >
                    {o.valor}
                  </td>

                  <td className="px-3 sm:px-4 py-3">
                    <Badge
                      variant={
                        statusVariant[o.status] ||
                        "neutral"
                      }
                      label={o.status}
                    />
                  </td>

                  <td
                    className="
                      px-3
                      sm:px-4

                      py-3

                      text-[11px]
                      sm:text-[12px]

                      text-[#6b7280]
                    "
                  >
                    {o.data}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ====================================================
            MOBILE
            Estrutura compacta de aplicativo.
        ==================================================== */}

        <div className="sm:hidden">
          {recentOrders.map((o) => (
            <div
              key={o.id}
              className="
                px-3
                py-3.5

                border-b
                border-[#f4f4f5]

                active:bg-[#fafafa]
                transition-colors
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-2
                  mb-2
                "
              >
                <span
                  className="
                    text-[12px]
                    font-semibold
                    text-[#15803d]
                  "
                >
                  {o.id}
                </span>

                <Badge
                  variant={
                    statusVariant[o.status] ||
                    "neutral"
                  }
                  label={o.status}
                />
              </div>

              <div className="min-w-0">
                <p
                  className="
                    text-[12px]
                    font-medium
                    text-[#0f1117]

                    truncate
                  "
                >
                  {o.cliente}
                </p>

                <p
                  className="
                    text-[10px]
                    text-[#6b7280]

                    truncate

                    mt-0.5
                  "
                >
                  {o.produto}
                </p>
              </div>

              <div
                className="
                  flex
                  items-center
                  justify-between

                  mt-2
                "
              >
                <span
                  className="
                    text-[10px]
                    text-[#9ca3af]
                  "
                >
                  {o.data}
                </span>

                <span
                  className="
                    text-[12px]
                    font-semibold
                    text-[#0f1117]
                  "
                >
                  {o.valor}
                </span>
              </div>
            </div>
          ))}

          {recentOrders.length === 0 && (
            <div
              className="
                min-h-[90px]

                flex
                items-center
                justify-center

                px-4

                text-center
              "
            >
              <span
                className="
                  text-[11px]
                  text-[#9ca3af]
                "
              >
                Nenhum pedido encontrado
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
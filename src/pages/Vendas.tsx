import { useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"];

const revenueData = [
  { mes: "Jan", receita: 18400, pedidos: 142 },
  { mes: "Fev", receita: 21200, pedidos: 168 },
  { mes: "Mar", receita: 19800, pedidos: 155 },
  { mes: "Abr", receita: 24600, pedidos: 192 },
  { mes: "Mai", receita: 28100, pedidos: 218 },
  { mes: "Jun", receita: 31400, pedidos: 247 },
  { mes: "Jul", receita: 29700, pedidos: 231 },
  { mes: "Ago", receita: 35200, pedidos: 274 },
  { mes: "Set", receita: 41800, pedidos: 312 },
];

const ticketData = months.map((mes, i) => ({
  mes,
  ticket: Math.round(revenueData[i].receita / revenueData[i].pedidos),
}));

const topCategories = [
  { nome: "Camisetas", receita: 89400, pct: 31 },
  { nome: "Calçados", receita: 72100, pct: 25 },
  { nome: "Calças", receita: 54800, pct: 19 },
  { nome: "Blusas", receita: 38600, pct: 13 },
  { nome: "Outros", receita: 33600, pct: 12 },
];

const kpis = [
  { label: "Receita total (set/26)", value: "R$ 41.800,00", change: "+18,8%", up: true },
  { label: "Pedidos (set/26)", value: "312", change: "+13,9%", up: true },
  { label: "Ticket médio", value: "R$ 134,00", change: "+4,3%", up: true },
  { label: "Taxa de cancelamento", value: "2,4%", change: "-0,8pp", up: true },
];

type Period = "3m" | "6m" | "9m";

export default function Vendas() {
  const [period, setPeriod] = useState<Period>("9m");

  const sliceMap: Record<Period, number> = { "3m": 3, "6m": 6, "9m": 9 };
  const slice = sliceMap[period];
  const data = revenueData.slice(-slice);

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] space-y-4 sm:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-[#e4e4e7] rounded-[6px] p-4">
            <p className="text-[12px] text-[#6b7280] font-medium mb-2">{k.label}</p>
            <p className="text-[20px] font-semibold text-[#0f1117] leading-none mb-1.5">{k.value}</p>
            <div className="flex items-center gap-1">
              {k.up ? <ArrowUpRight size={13} className="text-[#16a34a]" strokeWidth={2} /> : <ArrowDownRight size={13} className="text-[#b91c1c]" strokeWidth={2} />}
              <span className={`text-[11px] font-medium ${k.up ? "text-[#16a34a]" : "text-[#b91c1c]"}`}>{k.change}</span>
              <span className="text-[11px] text-[#9ca3af]">vs. mês anterior</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue bar chart */}
        <div className="lg:col-span-2 bg-white border border-[#e4e4e7] rounded-[6px]">
          <div className="px-4 py-3 border-b border-[#e4e4e7] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#0f1117]">Receita mensal</span>
            <div className="flex items-center gap-0.5 border border-[#e4e4e7] rounded-[4px] overflow-hidden">
              {(["3m", "6m", "9m"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${period === p ? "bg-[#16a34a] text-white" : "text-[#6b7280] hover:bg-[#f4f4f5]"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 4, boxShadow: "none" }}
                  formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Receita"]}
                />
                <Bar dataKey="receita" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top categories */}
        <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
          <div className="px-4 py-3 border-b border-[#e4e4e7]">
            <span className="text-[13px] font-semibold text-[#0f1117]">Receita por categoria</span>
          </div>
          <div className="px-4 py-3 space-y-3">
            {topCategories.map((c) => (
              <div key={c.nome}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-[#374151]">{c.nome}</span>
                  <span className="text-[12px] font-medium text-[#0f1117]">{c.pct}%</span>
                </div>
                <div className="h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden">
                  <div className="h-full bg-[#16a34a] rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
                <p className="text-[11px] text-[#9ca3af] mt-0.5">R$ {c.receita.toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket médio line chart */}
      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7]">
          <span className="text-[13px] font-semibold text-[#0f1117]">Evolução do ticket médio</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={ticketData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: "1px solid #e4e4e7", borderRadius: 4, boxShadow: "none" }}
                formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR")}`, "Ticket médio"]}
              />
              <Line type="monotone" dataKey="ticket" stroke="#16a34a" strokeWidth={1.5} dot={{ r: 3, strokeWidth: 0, fill: "#16a34a" }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import Badge from "../components/Badge";

interface Order {
  id: string;
  cliente: string;
  email: string;
  itens: number;
  valor: string;
  status: "Pago" | "Pendente" | "Enviado" | "Cancelado" | "Entregue";
  pagamento: string;
  data: string;
}

const orders: Order[] = [];

const statusVariant: Record<string, "success" | "warning" | "error" | "neutral" | "info"> = {
  Pago: "success",
  Pendente: "warning",
  Enviado: "info",
  Cancelado: "error",
  Entregue: "neutral",
};

const ALL = "Todos";
const tabs = [ALL, "Pago", "Pendente", "Enviado", "Entregue", "Cancelado"];

export default function Orders() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(ALL);

  const filtered = orders.filter((o) => {
    const matchSearch = o.cliente.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
    const matchTab = activeTab === ALL || o.status === activeTab;
    return matchSearch && matchTab;
  });

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[1200px] lg:px-6 lg:py-6">
      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-4 overflow-x-auto border-b border-[#e4e4e7]">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`min-h-10 shrink-0 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors lg:min-h-0 ${
              activeTab === t
                ? "border-[#16a34a] text-[#15803d]"
                : "border-transparent text-[#6b7280] hover:text-[#0f1117]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative w-full lg:max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Buscar pedido ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:pl-8 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
          />
        </div>
        <span className="text-[12px] text-[#6b7280]">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Lista mobile */}
      <div className="space-y-2.5 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white px-5 py-12 text-center">
            <ShoppingBag size={32} strokeWidth={1.5} className="mx-auto mb-2 text-[#d1d5db]" />
            <p className="text-[13px] font-medium text-[#374151]">Nenhum pedido encontrado</p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">Os pedidos realizados aparecerão aqui.</p>
          </div>
        ) : (
          filtered.map((o) => (
            <article key={o.id} className="rounded-2xl border border-[#e4e4e7] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#15803d]">{o.id}</p>
                  <h2 className="mt-1 truncate text-[14px] font-semibold text-[#0f1117]">{o.cliente}</h2>
                  <p className="truncate text-[11px] text-[#9ca3af]">{o.email}</p>
                </div>
                <Badge variant={statusVariant[o.status]} label={o.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#f4f4f5] bg-[#fafafa] p-3 text-[11px]">
                <div><p className="text-[#9ca3af]">Valor</p><p className="mt-0.5 text-[14px] font-semibold text-[#0f1117]">{o.valor}</p></div>
                <div><p className="text-[#9ca3af]">Pagamento</p><p className="mt-0.5 font-medium text-[#374151]">{o.pagamento}</p></div>
                <div><p className="text-[#9ca3af]">Itens</p><p className="mt-0.5 font-medium text-[#374151]">{o.itens}</p></div>
                <div><p className="text-[#9ca3af]">Data</p><p className="mt-0.5 font-medium text-[#374151]">{o.data}</p></div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Tabela desktop preservada */}
      <div className="hidden bg-white border border-[#e4e4e7] rounded-[6px] lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                {["Pedido", "Cliente", "Itens", "Valor", "Pagamento", "Status", "Data"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ShoppingBag size={32} strokeWidth={1.5} className="mx-auto text-[#d1d5db] mb-2" />
                    <p className="text-[13px] text-[#6b7280]">Nenhum pedido encontrado</p>
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="border-b border-[#f4f4f5] hover:bg-[#fafafa] transition-colors cursor-pointer">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-[#15803d]">{o.id}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-[13px] text-[#0f1117]">{o.cliente}</p>
                      <p className="text-[11px] text-[#9ca3af]">{o.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">{o.itens}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-[#0f1117]">{o.valor}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">{o.pagamento}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusVariant[o.status]} label={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">{o.data}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

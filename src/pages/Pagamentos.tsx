import { useState } from "react";
import { Search, Download } from "lucide-react";
import Badge from "../components/Badge";

interface Transaction {
  id: string;
  pedido: string;
  cliente: string;
  metodo: "Pix" | "Cartão" | "Boleto";
  valor: string;
  liquido: string;
  taxa: string;
  status: "Recebido" | "Pendente" | "Estornado" | "Falhou";
  data: string;
}

const transactions: Transaction[] = [];

const statusVariant: Record<string, "success" | "warning" | "error" | "neutral"> = {
  Recebido: "success",
  Pendente: "warning",
  Estornado: "neutral",
  Falhou: "error",
};

const metodoColors: Record<string, string> = {
  Pix: "text-[#15803d] bg-[#f0fdf4] border-[#bbf7d0]",
  Cartão: "text-[#1d4ed8] bg-[#eff6ff] border-[#bfdbfe]",
  Boleto: "text-[#b45309] bg-[#fffbeb] border-[#fde68a]",
};

const summary = [
  { label: "Recebido hoje", value: "R$ 0,00", sub: "0 transações" },
  { label: "Pendente", value: "R$ 0,00", sub: "0 transações" },
  { label: "Recebido no mês", value: "R$ 0,00", sub: "Nenhum recebimento" },
  { label: "Taxas pagas", value: "R$ 0,00", sub: "Nenhuma taxa" },
];

export default function Pagamentos() {
  const [search, setSearch] = useState("");

  const filtered = transactions.filter(
    (t) =>
      t.cliente.toLowerCase().includes(search.toLowerCase()) ||
      t.pedido.includes(search) ||
      t.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[1200px] lg:px-6 lg:py-6 space-y-4 lg:space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4">
        {summary.map((s) => (
          <div key={s.label} className="bg-white border border-[#e4e4e7] rounded-[6px] p-4">
            <p className="text-[12px] text-[#6b7280] font-medium mb-1.5">{s.label}</p>
            <p className="text-[18px] font-semibold text-[#0f1117] leading-none mb-1">{s.value}</p>
            <p className="text-[11px] text-[#9ca3af]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="relative min-w-0 flex-1 lg:max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Buscar transação ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:pl-8 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
          />
        </div>
        <button className="flex h-11 shrink-0 items-center gap-1.5 px-3 text-[13px] text-[#374151] border border-[#e4e4e7] rounded-xl bg-white hover:bg-[#f4f4f5] transition-colors lg:h-auto lg:py-1.5 lg:rounded-[6px]">
          <Download size={14} strokeWidth={1.8} /> <span className="hidden sm:inline">Exportar</span>
        </button>
      </div>

      {/* Lista mobile */}
      <div className="space-y-2.5 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white px-5 py-12 text-center">
            <Download size={30} strokeWidth={1.5} className="mx-auto mb-2 text-[#d1d5db]" />
            <p className="text-[13px] font-medium text-[#374151]">Nenhum pagamento encontrado</p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">As transações realizadas aparecerão aqui.</p>
          </div>
        ) : (
          filtered.map((t) => (
            <article key={t.id} className="rounded-2xl border border-[#e4e4e7] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-mono text-[11px] text-[#6b7280]">{t.id}</p><h2 className="mt-1 truncate text-[14px] font-semibold text-[#0f1117]">{t.cliente}</h2><p className="text-[11px] font-medium text-[#15803d]">Pedido {t.pedido}</p></div>
                <Badge variant={statusVariant[t.status]} label={t.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[#f4f4f5] bg-[#fafafa] p-3">
                <div><p className="text-[10px] text-[#9ca3af]">Valor bruto</p><p className="mt-0.5 text-[14px] font-semibold text-[#0f1117]">{t.valor}</p></div>
                <div><p className="text-[10px] text-[#9ca3af]">Líquido</p><p className="mt-0.5 text-[14px] font-semibold text-[#0f1117]">{t.liquido}</p></div>
                <div><p className="text-[10px] text-[#9ca3af]">Método</p><span className={`mt-1 inline-flex rounded-[3px] border px-1.5 py-0.5 text-[11px] font-medium ${metodoColors[t.metodo]}`}>{t.metodo}</span></div>
                <div><p className="text-[10px] text-[#9ca3af]">Taxa / data</p><p className="mt-0.5 text-[11px] text-[#374151]">{t.taxa} • {t.data}</p></div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Tabela desktop preservada */}
      <div className="hidden bg-white border border-[#e4e4e7] rounded-[6px] lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                {["ID Transação", "Pedido", "Cliente", "Método", "Valor bruto", "Taxa", "Líquido", "Status", "Data"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-[#6b7280]">Nenhum pagamento encontrado</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="border-b border-[#f4f4f5] hover:bg-[#fafafa] transition-colors">
                  <td className="px-4 py-2.5 text-[11px] font-mono text-[#6b7280]">{t.id}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-[#15803d]">{t.pedido}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#0f1117]">{t.cliente}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-[3px] border ${metodoColors[t.metodo]}`}>
                      {t.metodo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-[#0f1117]">{t.valor}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">{t.taxa}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-[#0f1117]">{t.liquido}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[t.status]} label={t.status} />
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">{t.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

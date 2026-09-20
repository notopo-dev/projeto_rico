import { useState } from "react";
import { Search, Users } from "lucide-react";
import Badge from "../components/Badge";

const customers: Array<{
  id: string;
  nome: string;
  email: string;
  telefone: string;
  pedidos: number;
  gasto: string;
  ultima: string;
  status: string;
}> = [];

export default function Customers() {
  const [search, setSearch] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[1200px] lg:px-6 lg:py-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative w-full lg:max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" strokeWidth={2} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:pl-8 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
          />
        </div>
        <span className="text-[12px] text-[#6b7280]">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2.5 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white px-5 py-12 text-center">
            <Users size={32} strokeWidth={1.5} className="mx-auto mb-2 text-[#d1d5db]" />
            <p className="text-[13px] font-medium text-[#374151]">Nenhum cliente encontrado</p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">Os clientes cadastrados aparecerão aqui.</p>
          </div>
        ) : filtered.map((c) => (
          <article key={c.id} className="rounded-2xl border border-[#e4e4e7] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e4e4e7] text-[13px] font-semibold text-[#374151]">{c.nome.charAt(0)}</div><div className="min-w-0"><h2 className="truncate text-[14px] font-semibold text-[#0f1117]">{c.nome}</h2><p className="truncate text-[11px] text-[#9ca3af]">{c.email}</p></div></div>
              <Badge variant={c.status === "Ativo" ? "success" : "neutral"} label={c.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[#f4f4f5] bg-[#fafafa] p-3 text-[11px]"><div><p className="text-[#9ca3af]">Telefone</p><p className="mt-0.5 font-medium text-[#374151]">{c.telefone}</p></div><div><p className="text-[#9ca3af]">Pedidos</p><p className="mt-0.5 font-medium text-[#374151]">{c.pedidos}</p></div><div><p className="text-[#9ca3af]">Total gasto</p><p className="mt-0.5 text-[13px] font-semibold text-[#0f1117]">{c.gasto}</p></div><div><p className="text-[#9ca3af]">Última compra</p><p className="mt-0.5 font-medium text-[#374151]">{c.ultima}</p></div></div>
          </article>
        ))}
      </div>

      <div className="hidden bg-white border border-[#e4e4e7] rounded-[6px] lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                {["Cliente", "Telefone", "Pedidos", "Total gasto", "Última compra", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users size={32} strokeWidth={1.5} className="mx-auto text-[#d1d5db] mb-2" />
                    <p className="text-[13px] text-[#6b7280]">Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[#f4f4f5] hover:bg-[#fafafa] transition-colors cursor-pointer">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#e4e4e7] flex items-center justify-center text-[11px] font-semibold text-[#374151] shrink-0">
                          {c.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#0f1117]">{c.nome}</p>
                          <p className="text-[11px] text-[#9ca3af]">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">{c.telefone}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">{c.pedidos}</td>
                    <td className="px-4 py-2.5 text-[13px] font-semibold text-[#0f1117]">{c.gasto}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">{c.ultima}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={c.status === "Ativo" ? "success" : "neutral"} label={c.status} />
                    </td>
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

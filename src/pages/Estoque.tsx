import { useState } from "react";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";

interface StockItem {
  id: string;
  nome: string;
  sku: string;
  categoria: string;
  estoque: number;
  minimo: number;
}

// ============================================================
// DADOS
// ============================================================
// Os produtos serão carregados posteriormente do Supabase.
// Nenhum produto fictício é mantido neste arquivo.

const initialItems: StockItem[] = [];

type Filter = "todos" | "ok" | "baixo" | "sem";

function getStatus(item: StockItem): "ok" | "baixo" | "sem" {
  if (item.estoque === 0) return "sem";
  if (item.estoque < item.minimo) return "baixo";
  return "ok";
}

const filterLabels: Record<Filter, string> = {
  todos: "Todos",
  ok: "Em estoque",
  baixo: "Estoque baixo",
  sem: "Sem estoque",
};

export default function Estoque() {
  const [items, setItems] = useState<StockItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = items.filter((item) => {
    const matchSearch =
      item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());

    const status = getStatus(item);

    const matchFilter =
      filter === "todos" || status === filter;

    return matchSearch && matchFilter;
  });

  const counts = {
    sem: items.filter((i) => getStatus(i) === "sem").length,
    baixo: items.filter((i) => getStatus(i) === "baixo").length,
  };

  function startEdit(item: StockItem) {
    setEditing(item.id);
    setEditValue(String(item.estoque));
  }

  function confirmEdit(id: string) {
    const val = parseInt(editValue, 10);

    if (!isNaN(val) && val >= 0) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, estoque: val }
            : i
        )
      );
    }

    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[1100px] lg:px-6 lg:py-6">

      {/* ======================================================
          ALERTAS
      ====================================================== */}

      {counts.sem > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded-[6px] mb-3 text-[13px] text-[#b91c1c]">
          <XCircle
            size={15}
            strokeWidth={2}
            className="shrink-0"
          />

          <span>
            <strong>
              {counts.sem} produto
              {counts.sem > 1 ? "s" : ""}
            </strong>{" "}
            sem estoque — verifique a reposição.
          </span>
        </div>
      )}

      {counts.baixo > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#fffbeb] border border-[#fde68a] rounded-[6px] mb-4 text-[13px] text-[#b45309]">
          <AlertTriangle
            size={15}
            strokeWidth={2}
            className="shrink-0"
          />

          <span>
            <strong>
              {counts.baixo} produto
              {counts.baixo > 1 ? "s" : ""}
            </strong>{" "}
            abaixo do estoque mínimo.
          </span>
        </div>
      )}

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <div className="flex flex-wrap items-center gap-3 mb-4">

        <div className="relative w-full lg:max-w-xs">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            strokeWidth={2}
          />

          <input
            type="text"
            placeholder="Buscar produto ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-11 pl-9 pr-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:pl-8 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
          />
        </div>

        <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#e4e4e7] bg-white p-1 lg:w-auto lg:rounded-[6px] lg:p-0">
          {(Object.keys(filterLabels) as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors lg:min-h-0 lg:rounded-none ${
                filter === f
                  ? "bg-[#16a34a] text-white"
                  : "text-[#374151] hover:bg-[#f4f4f5]"
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista mobile */}
      <div className="space-y-2.5 lg:hidden">
        <div className="px-1">
          <span className="text-[12px] text-[#6b7280]">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f5]">
              <CheckCircle2 size={23} strokeWidth={1.7} className="text-[#a1a1aa]" />
            </div>
            <p className="text-[13px] font-medium text-[#374151]">Nenhum produto encontrado</p>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              {search || filter !== "todos"
                ? "Altere a busca ou o filtro para tentar novamente."
                : "Os produtos cadastrados aparecerão aqui."}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const status = getStatus(item);

            return (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 ${
                  status === "sem"
                    ? "border-[#fecaca] bg-[#fff8f8]"
                    : status === "baixo"
                    ? "border-[#fde68a] bg-[#fffdf4]"
                    : "border-[#e4e4e7] bg-white"
                }`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold text-[#0f1117]">{item.nome}</h2>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-[#9ca3af]">
                      <span className="shrink-0 font-mono">{item.sku}</span>
                      <span>•</span>
                      <span className="truncate">{item.categoria}</span>
                    </div>
                  </div>

                  {status === "ok" && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#15803d]">
                      <CheckCircle2 size={12} strokeWidth={2} /> Em estoque
                    </span>
                  )}
                  {status === "baixo" && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#b45309]">
                      <AlertTriangle size={12} strokeWidth={2} /> Baixo
                    </span>
                  )}
                  {status === "sem" && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#b91c1c]">
                      <XCircle size={12} strokeWidth={2} /> Esgotado
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 divide-x divide-[#e4e4e7] rounded-xl border border-[#e4e4e7] bg-white/70">
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#9ca3af]">Mínimo</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-[#374151]">{item.minimo}</p>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-[#9ca3af]">Estoque atual</p>
                    {editing === item.id ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmEdit(item.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-[#16a34a] px-2 text-base focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => confirmEdit(item.id)} aria-label="Confirmar estoque" className="flex h-10 w-9 items-center justify-center rounded-lg text-[#16a34a]">
                          <Check size={16} strokeWidth={2.5} />
                        </button>
                        <button onClick={cancelEdit} aria-label="Cancelar edição" className="flex h-10 w-9 items-center justify-center rounded-lg text-[#6b7280]">
                          <X size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className={`mt-0.5 text-[14px] font-semibold ${status === "sem" ? "text-[#b91c1c]" : status === "baixo" ? "text-[#b45309]" : "text-[#0f1117]"}`}>
                          {item.estoque}
                        </p>
                        <button onClick={() => startEdit(item)} aria-label={`Editar estoque de ${item.nome}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6b7280] active:bg-[#f4f4f5]">
                          <Pencil size={16} strokeWidth={1.8} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Tabela desktop preservada */}

      <div className="hidden bg-white border border-[#e4e4e7] rounded-[6px] lg:block">

        <div className="px-4 py-2.5 border-b border-[#e4e4e7]">
          <span className="text-[12px] text-[#6b7280]">
            {filtered.length} produto
            {filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">

            <thead>
              <tr className="border-b border-[#e4e4e7] bg-[#fafafa]">
                {[
                  "Produto",
                  "SKU",
                  "Categoria",
                  "Mínimo",
                  "Estoque atual",
                  "Status",
                  "Editar",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[#6b7280]">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}

              {filtered.map((item) => {
                const status = getStatus(item);

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-[#f4f4f5] transition-colors ${
                      status === "sem"
                        ? "bg-[#fff8f8]"
                        : status === "baixo"
                        ? "bg-[#fffdf4]"
                        : "hover:bg-[#fafafa]"
                    }`}
                  >

                    <td className="px-4 py-2.5 text-[13px] font-medium text-[#0f1117]">
                      {item.nome}
                    </td>

                    <td className="px-4 py-2.5 text-[12px] text-[#6b7280] font-mono">
                      {item.sku}
                    </td>

                    <td className="px-4 py-2.5 text-[12px] text-[#374151]">
                      {item.categoria}
                    </td>

                    <td className="px-4 py-2.5 text-[12px] text-[#6b7280]">
                      {item.minimo}
                    </td>

                    <td className="px-4 py-2.5">

                      {editing === item.id ? (
                        <div className="flex items-center gap-1">

                          <input
                            type="number"
                            min="0"
                            value={editValue}
                            onChange={(e) =>
                              setEditValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                confirmEdit(item.id);
                              }

                              if (e.key === "Escape") {
                                cancelEdit();
                              }
                            }}
                            className="w-16 px-2 py-0.5 text-[13px] border border-[#16a34a] rounded-[4px] focus:outline-none"
                            autoFocus
                          />

                          <button
                            onClick={() =>
                              confirmEdit(item.id)
                            }
                            className="p-0.5 text-[#16a34a] hover:text-[#15803d]"
                          >
                            <Check
                              size={14}
                              strokeWidth={2.5}
                            />
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="p-0.5 text-[#9ca3af] hover:text-[#6b7280]"
                          >
                            <X
                              size={14}
                              strokeWidth={2.5}
                            />
                          </button>

                        </div>
                      ) : (
                        <span
                          className={`text-[13px] font-semibold ${
                            status === "sem"
                              ? "text-[#b91c1c]"
                              : status === "baixo"
                              ? "text-[#b45309]"
                              : "text-[#0f1117]"
                          }`}
                        >
                          {item.estoque}
                        </span>
                      )}

                    </td>

                    <td className="px-4 py-2.5">

                      {status === "ok" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803d]">
                          <CheckCircle2
                            size={12}
                            strokeWidth={2}
                          />
                          Em estoque
                        </span>
                      )}

                      {status === "baixo" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b45309]">
                          <AlertTriangle
                            size={12}
                            strokeWidth={2}
                          />
                          Baixo
                        </span>
                      )}

                      {status === "sem" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#b91c1c]">
                          <XCircle
                            size={12}
                            strokeWidth={2}
                          />
                          Esgotado
                        </span>
                      )}

                    </td>

                    <td className="px-4 py-2.5">

                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 text-[#6b7280] hover:text-[#0f1117] rounded hover:bg-[#f4f4f5]"
                      >
                        <Pencil
                          size={14}
                          strokeWidth={1.8}
                        />
                      </button>

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}
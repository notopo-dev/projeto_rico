import type { PublicCategory } from "../lib/storeApi";

interface CategoryPillsProps {
  categorias: PublicCategory[];
  selecionada: string | null;
  onSelect: (categoriaId: string | null) => void;
}

export default function CategoryPills({
  categorias,
  selecionada,
  onSelect,
}: CategoryPillsProps) {
  return (
    <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 h-10 px-5 rounded-full text-[13px] font-semibold transition-all active:scale-95 ${
          selecionada === null
            ? "text-white shadow-md"
            : "bg-white text-[#374151] border border-black/[0.06] shadow-sm"
        }`}
        style={
          selecionada === null
            ? { backgroundColor: "var(--store-primary)" }
            : undefined
        }
      >
        Todos
      </button>
      {categorias.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`shrink-0 h-10 px-5 rounded-full text-[13px] font-semibold transition-all active:scale-95 ${
            selecionada === c.id
              ? "text-white shadow-md"
              : "bg-white text-[#374151] border border-black/[0.06] shadow-sm"
          }`}
          style={
            selecionada === c.id
              ? { backgroundColor: "var(--store-primary)" }
              : undefined
          }
        >
          {c.nome}
        </button>
      ))}
    </div>
  );
}
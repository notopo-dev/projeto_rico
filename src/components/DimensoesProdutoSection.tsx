import { Package, Info } from "lucide-react";

interface Props {
  peso: string;
  altura: string;
  largura: string;
  comprimento: string;
  onChange: (campo: "peso" | "altura" | "largura" | "comprimento", valor: string) => void;
}

/**
 * Campos de peso e medidas do produto, usados no cálculo de
 * frete. Inclua no modal de cadastro/edição de produto.
 */
export default function DimensoesProdutoSection({
  peso,
  altura,
  largura,
  comprimento,
  onChange,
}: Props) {
  const inputCls =
    "w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-base outline-none placeholder:text-[#a1a1aa] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10 lg:text-[13px]";
  const labelCls = "block text-[12px] font-semibold text-[#374151] mb-1.5";

  const incompleto = !peso || !altura || !largura || !comprimento;

  return (
    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Package size={14} className="text-[#6b7280]" />
        <p className="text-[13px] font-medium text-[#111827]">
          Peso e medidas (para o frete)
        </p>
      </div>
      <p className="text-[11px] text-[#6b7280] mb-3">
        Informe as medidas do produto embalado, pronto para envio.
      </p>

      <div className="space-y-3">
        <div>
          <label className={labelCls}>Peso (gramas)</label>
          <input
            type="number"
            min={0}
            value={peso}
            onChange={(e) => onChange("peso", e.target.value)}
            placeholder="Ex: 300"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Altura (cm)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={altura}
              onChange={(e) => onChange("altura", e.target.value)}
              placeholder="2"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Largura (cm)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={largura}
              onChange={(e) => onChange("largura", e.target.value)}
              placeholder="11"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Compr. (cm)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={comprimento}
              onChange={(e) => onChange("comprimento", e.target.value)}
              placeholder="16"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {incompleto && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#92400e]">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            Sem essas medidas, este produto não poderá ser vendido com cálculo
            de frete.
          </span>
        </div>
      )}
    </div>
  );
}
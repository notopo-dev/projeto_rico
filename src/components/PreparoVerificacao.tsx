import {
  ShieldCheck,
  Smartphone,
  IdCard,
  Clock,
  Wifi,
  ArrowRight,
  Sun,
} from "lucide-react";

/**
 * Tela de preparo, mostrada ANTES de abrir a verificação de identidade.
 *
 * Por que existe: a etapa de identidade é obrigatória por lei (Banco
 * Central e regras antilavagem) e não dá para pular. O que dá para
 * controlar é a surpresa — lojista que sabe o que vem pela frente
 * desiste muito menos do que o que é jogado direto num formulário de
 * documento e selfie.
 *
 * Fica dentro do nosso painel, com a nossa linguagem.
 */

interface Props {
  onComecar: () => void;
  /** Mostrado no topo quando há pendências específicas. */
  quantidadePendencias?: number;
}

const ITENS = [
  {
    icone: IdCard,
    titulo: "Documento com foto em mãos",
    texto:
      "RG, CNH ou passaporte. O documento físico, não uma cópia ou foto de tela.",
  },
  {
    icone: Smartphone,
    titulo: "De preferência pelo celular",
    texto:
      "A câmera do celular facilita a foto do documento e a selfie. Dá para fazer no computador, mas costuma dar mais trabalho.",
  },
  {
    icone: Sun,
    titulo: "Um lugar bem iluminado",
    texto:
      "Luz fraca e reflexo são o motivo mais comum de o documento ser recusado.",
  },
  {
    icone: Wifi,
    titulo: "Internet estável",
    texto: "Se cair no meio, você recomeça do zero.",
  },
];

export default function PreparoVerificacao({
  onComecar,
  quantidadePendencias,
}: Props) {
  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
      <div className="px-4 py-4 border-b border-[#e4e4e7] flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#f0fdf4] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-[#16a34a]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#0f1117]">
            Confirmação de identidade
          </h2>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5 leading-snug">
            Última etapa para liberar os recebimentos da sua loja.
            {typeof quantidadePendencias === "number" &&
              quantidadePendencias > 0 &&
              ` Faltam ${quantidadePendencias} ${
                quantidadePendencias === 1 ? "informação" : "informações"
              }.`}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="rounded-xl bg-[#fafafa] border border-[#e4e4e7] px-3.5 py-3">
          <p className="text-[12.5px] text-[#374151] leading-relaxed">
            Quem recebe dinheiro de clientes precisa comprovar identidade —
            é exigência do Banco Central, vale para qualquer plataforma de
            vendas. <strong>Leva cerca de 3 minutos</strong> e é uma vez só.
          </p>
        </div>

        <div>
          <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold mb-2">
            Antes de começar
          </p>
          <div className="space-y-2.5">
            {ITENS.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#f4f4f5] flex items-center justify-center shrink-0 mt-0.5">
                  <Icone size={14} className="text-[#6b7280]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111827]">
                    {titulo}
                  </p>
                  <p className="text-[12px] text-[#6b7280] leading-snug mt-0.5">
                    {texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold mb-2">
            O que vai acontecer
          </p>
          <ol className="space-y-1.5">
            {[
              "Você confirma seu e-mail com um código",
              "Responde algumas perguntas sobre a loja",
              "Fotografa o documento e tira uma selfie",
              "Pronto — a análise leva de minutos a 2 dias úteis",
            ].map((passo, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-[#0f1117] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-[#374151] leading-snug">
                  {passo}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <button
          onClick={onComecar}
          className="w-full h-12 min-h-[48px] rounded-xl bg-[#0f1117] text-white text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          Começar agora
          <ArrowRight size={16} />
        </button>

        <p className="text-[11px] text-[#9ca3af] text-center leading-snug flex items-center justify-center gap-1.5">
          <Clock size={12} />
          Dá para parar no meio e continuar depois de onde parou.
        </p>
      </div>
    </div>
  );
}

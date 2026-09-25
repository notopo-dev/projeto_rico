import { Loader2 } from "lucide-react";

/**
 * Estados de carregamento do painel.
 *
 * A regra: nunca mostrar tela branca. Ou um esqueleto com o formato do
 * conteúdo que vem, ou um spinner com uma linha de texto. Tela branca
 * parece travamento; esqueleto parece rápido, mesmo demorando igual.
 */

/** Bloco cinza que pulsa. Use para montar o formato da tela. */
export function Esqueleto({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`esqueleto ${className}`} />;
}

/** Tela inteira, para a primeira carga do app. */
export function TelaCarregando({ texto }: { texto?: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[var(--app-fundo)]">
      <div className="w-11 h-11 rounded-2xl bg-[#0f1117] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white" />
      </div>
      {texto && (
        <p className="text-[13px] text-[#6b7280] anim-surgir">{texto}</p>
      )}
    </div>
  );
}

/** Dentro de um cartão ou seção. */
export function BlocoCarregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#6b7280]">
      <Loader2 size={15} className="animate-spin" />
      {texto}
    </div>
  );
}

/** Formato de lista: linhas com avatar e duas faixas de texto. */
export function ListaCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-live="polite">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="cartao-app p-3.5 flex gap-3 items-center">
          <Esqueleto className="w-11 h-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-3 w-1/2" />
            <Esqueleto className="h-2.5 w-1/3" />
          </div>
          <Esqueleto className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Formato de cartões de número (visão geral). */
export function CartoesCarregando({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="cartao-app p-4 space-y-3">
          <Esqueleto className="h-2.5 w-2/3" />
          <Esqueleto className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Formato de grade de produtos. */
export function GradeCarregando({ quantidade = 6 }: { quantidade?: number }) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="cartao-app overflow-hidden">
          <Esqueleto className="w-full aspect-square rounded-none" />
          <div className="p-3 space-y-2">
            <Esqueleto className="h-3 w-4/5" />
            <Esqueleto className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

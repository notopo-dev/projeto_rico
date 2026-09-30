import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Folha: o modal do painel.
 *
 * ----------------------------------------------------------------
 * Por que existe, e por que usa portal
 * ----------------------------------------------------------------
 * No celular, o botão de salvar do cadastro de produto não aparecia.
 * A estrutura do modal estava certa — corpo rolável, rodapé fora da
 * rolagem — e reproduzindo a casca do app num navegador de mesa o
 * rodapé aparecia. Ou seja: o defeito depende do aparelho.
 *
 * A causa é de fora do modal. Ele nascia dentro de
 * `main > div > div.anim-aparecer > página`, e um ancestral com
 * animação, transform ou filtro cria contexto de empilhamento: o
 * `z-50` do modal deixa de competir com a barra inferior e passa a
 * valer só dentro daquele ancestral. A barra, que é irmã lá em cima,
 * ganha — e cobre justamente a faixa onde fica o rodapé.
 *
 * Em vez de caçar qual ancestral é o culpado em cada aparelho, esta
 * folha se desenha em `document.body`, fora de todos eles. Aí não
 * existe ancestral que possa prendê-la. Vale para qualquer navegador,
 * hoje e depois de qualquer mudança de layout.
 *
 * ----------------------------------------------------------------
 * O que ela garante
 * ----------------------------------------------------------------
 * - O rodapé NUNCA rola junto: quem rola é só o corpo.
 * - O rodapé respeita a faixa inferior do iPhone.
 * - Fecha com Esc.
 * - Trava a rolagem da página atrás, para o dedo não arrastar a
 *   lista de produtos enquanto se preenche o formulário.
 *
 * A aparência mora no index.css, nas classes .folha-*.
 */

interface Props {
  aberta: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Botões de ação. Ficam fora da área de rolagem, sempre à vista. */
  rodape: ReactNode;
  children: ReactNode;
  /** Rótulo do botão de fechar, para leitor de tela. */
  rotuloFechar?: string;
}

export default function Folha({
  aberta,
  onFechar,
  titulo,
  descricao,
  rodape,
  children,
  rotuloFechar = "Fechar",
}: Props) {
  // Esc fecha. Registra só enquanto aberta, para não acumular
  // ouvintes quando várias folhas existem na mesma tela.
  useEffect(() => {
    if (!aberta) return;

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, onFechar]);

  // Trava a rolagem de trás. Guarda o valor anterior em vez de
  // assumir "", senão fechar a folha apagaria um overflow que outra
  // parte da tela tivesse definido.
  useEffect(() => {
    if (!aberta) return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberta]);

  if (!aberta) return null;

  return createPortal(
    <div
      className="folha-fundo bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => {
        // Fecha ao clicar no fundo, nunca ao clicar dentro. mouseDown
        // e não click: um arrasto que começa dentro e termina no fundo
        // fecharia a folha no meio de uma seleção de texto.
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="folha">
        <div className="folha-topo px-4 pt-4 pb-3 border-b border-[#f0f0f1] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-secao text-[#0f1117]">{titulo}</p>
            {descricao && (
              <p className="t-apoio text-[#6b7280] mt-0.5 leading-snug">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label={rotuloFechar}
            className="shrink-0 w-9 h-9 -mr-1.5 -mt-1 rounded-lg flex items-center justify-center text-[#6b7280] hover:bg-[#f4f4f5]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="folha-corpo px-4 py-4">{children}</div>

        <div className="folha-rodape px-4 py-3 border-t border-[#f0f0f1] bg-white flex gap-2">
          {rodape}
        </div>
      </div>
    </div>,
    document.body,
  );
}

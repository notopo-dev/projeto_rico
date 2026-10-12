import { useState } from "react";
// Só estes dois: os ícones das telas vêm do menu lateral junto com
// os itens. Os catorze que ficavam aqui eram cópia da outra lista.
import { MoreHorizontal, X } from "lucide-react";
import type { Page, NavItem } from "./Sidebar";
import { GRUPOS_DO_MENU } from "./Sidebar";

/**
 * Navegação inferior, só no celular.
 *
 * O padrão de app: os quatro destinos mais usados sempre à mão, com o
 * polegar, e o resto atrás de "Mais". Substitui o menu hambúrguer, que
 * exige duas ações para qualquer navegação.
 *
 * No desktop (lg+) fica escondida — lá a barra lateral cumpre o papel.
 */

interface Props {
  current: Page;
  onNavigate: (p: Page) => void;
}

/**
 * Os quatro destinos do polegar.
 *
 * Só esta lista é escrita à mão — tudo o mais vem do menu lateral.
 * Antes havia duas listas completas e independentes, e elas
 * divergiram: telas novas apareciam no computador e não no celular.
 */
const IDS_PRINCIPAIS: Page[] = ["dashboard", "pedidos", "produtos", "vendas"];

/** Todas as telas do sistema, na ordem do menu lateral. */
const TODAS: NavItem[] = GRUPOS_DO_MENU.flatMap((g) => g.items);

const PRINCIPAIS: NavItem[] = IDS_PRINCIPAIS.map((id) => {
  const achado = TODAS.find((i) => i.id === id);
  if (!achado) {
    // Em vez de sumir em silêncio: id principal que não existe mais no
    // menu é erro de programação, e tem que aparecer na hora.
    throw new Error(`BottomNav: "${id}" não está no menu lateral.`);
  }
  return achado;
});

/**
 * O resto, atrás de "Mais".
 *
 * Derivado por SUBTRAÇÃO: tela nova no menu lateral cai aqui
 * automaticamente. É o que impede de uma tela existir no computador e
 * não no celular.
 */
const SECUNDARIAS: NavItem[] = TODAS.filter(
  (i) => !IDS_PRINCIPAIS.includes(i.id),
);

export default function BottomNav({ current, onNavigate }: Props) {
  const [maisAberto, setMaisAberto] = useState(false);
  const emSecundaria = SECUNDARIAS.some((s) => s.id === current);

  function ir(p: Page) {
    setMaisAberto(false);
    onNavigate(p);
  }

  return (
    <>
      {/* Folha de "Mais" */}
      {maisAberto && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            aria-label="Fechar menu"
            onClick={() => setMaisAberto(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl anim-surgir safe-bottom">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="t-secao font-bold text-[#0f1117]">Menu</h2>
              <button
                onClick={() => setMaisAberto(false)}
                className="toque w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center"
                aria-label="Fechar"
              >
                <X size={17} className="text-[#374151]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-5 pt-1 anim-lista">
              {SECUNDARIAS.map(({ id, label, icon: Icone, emBreve }) => {
                const ativa = id === current;
                return (
                  <button
                    key={id}
                    onClick={() => ir(id)}
                    className={`cartao-toque flex flex-col items-center justify-center gap-2 py-4 rounded-lg border ${
                      ativa
                        ? "bg-[#0f1117] border-[#0f1117] text-white"
                        : "bg-[#fafafa] border-[#e7e7ea] text-[#374151]"
                    }`}
                  >
                    <Icone size={21} strokeWidth={1.9} />
                    <span className="t-apoio font-medium leading-none text-center px-1">
                      {label}
                    </span>
                    {/* Mesma etiqueta do menu lateral: a tela não pode
                        parecer pronta num lugar e "em breve" no outro. */}
                    {emBreve && (
                      <span
                        className={`t-micro font-semibold leading-none ${
                          ativa ? "text-white/70" : "text-[#9ca3af]"
                        }`}
                      >
                        em breve
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barra fixa */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e7e7ea] safe-bottom"
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch">
          {PRINCIPAIS.map(({ id, label, icon: Icone }) => {
            const ativa = id === current;
            return (
              <button
                key={id}
                onClick={() => ir(id)}
                aria-current={ativa ? "page" : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 active:scale-95 transition-transform"
              >
                <Icone
                  size={21}
                  strokeWidth={ativa ? 2.3 : 1.8}
                  className={ativa ? "text-[#0f1117]" : "text-[#9ca3af]"}
                />
                <span
                  className={`t-micro leading-none ${
                    ativa
                      ? "font-bold text-[#0f1117]"
                      : "font-medium text-[#9ca3af]"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            className="flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 active:scale-95 transition-transform"
          >
            <MoreHorizontal
              size={21}
              strokeWidth={emSecundaria || maisAberto ? 2.3 : 1.8}
              className={
                emSecundaria || maisAberto ? "text-[#0f1117]" : "text-[#9ca3af]"
              }
            />
            <span
              className={`t-micro leading-none ${
                emSecundaria || maisAberto
                  ? "font-bold text-[#0f1117]"
                  : "font-medium text-[#9ca3af]"
              }`}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart2,
  MoreHorizontal,
  Store,
  Tag,
  Users,
  Boxes,
  CreditCard,
  Landmark,
  MessageCircle,
  Settings,
  X,
} from "lucide-react";
import type { Page } from "./Sidebar";

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

const PRINCIPAIS: { id: Page; label: string; icone: React.ElementType }[] = [
  { id: "dashboard", label: "Início", icone: LayoutDashboard },
  { id: "pedidos", label: "Pedidos", icone: ShoppingBag },
  { id: "produtos", label: "Produtos", icone: Package },
  { id: "vendas", label: "Vendas", icone: BarChart2 },
];

const SECUNDARIAS: { id: Page; label: string; icone: React.ElementType }[] = [
  { id: "loja", label: "Loja", icone: Store },
  { id: "categorias", label: "Categorias", icone: Tag },
  { id: "clientes", label: "Clientes", icone: Users },
  { id: "estoque", label: "Estoque", icone: Boxes },
  { id: "pagamentos", label: "Pagamentos", icone: CreditCard },
  { id: "recebimentos", label: "Recebimentos", icone: Landmark },
  { id: "whatsapp", label: "WhatsApp", icone: MessageCircle },
  { id: "configuracoes", label: "Configurações", icone: Settings },
];

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
              <h2 className="text-[15px] font-bold text-[#0f1117]">Menu</h2>
              <button
                onClick={() => setMaisAberto(false)}
                className="toque w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center"
                aria-label="Fechar"
              >
                <X size={17} className="text-[#374151]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-5 pt-1 anim-lista">
              {SECUNDARIAS.map(({ id, label, icone: Icone }) => {
                const ativa = id === current;
                return (
                  <button
                    key={id}
                    onClick={() => ir(id)}
                    className={`cartao-toque flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border ${
                      ativa
                        ? "bg-[#0f1117] border-[#0f1117] text-white"
                        : "bg-[#fafafa] border-[#e7e7ea] text-[#374151]"
                    }`}
                  >
                    <Icone size={21} strokeWidth={1.9} />
                    <span className="text-[11.5px] font-medium leading-none text-center px-1">
                      {label}
                    </span>
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
          {PRINCIPAIS.map(({ id, label, icone: Icone }) => {
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
                  className={`text-[10.5px] leading-none ${
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
              className={`text-[10.5px] leading-none ${
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

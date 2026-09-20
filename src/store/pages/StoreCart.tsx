import { useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreCart() {
  const { store } = useStore();
  const { items, updateQuantidade, removeItem, total } = useCart();
  const navigate = useNavigate();

  if (!store) return null;

  return (
    <div className="min-h-dvh bg-[#fafafa] pb-32">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft size={19} className="text-[#374151]" />
        </button>
        <h1 className="text-[15px] font-bold text-[#111827]">Seu carrinho</h1>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-black/5 flex items-center justify-center mb-3">
            <ShoppingBag size={26} className="text-[#d4d4d8]" strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-semibold text-[#111827]">
            Seu carrinho está vazio
          </p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">
            Adicione produtos para continuar.
          </p>
          <button
            onClick={() => navigate(`/loja/${store.slug}`)}
            className="mt-5 h-11 px-6 rounded-full text-white text-[13px] font-semibold"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Ver produtos
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 space-y-2.5">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.corSelecionada ?? ""}-${item.tamanhoSelecionado ?? ""}`}
                className="bg-white rounded-2xl border border-black/5 p-3 flex gap-3"
              >
                <div className="w-16 h-16 rounded-xl bg-[#f4f4f5] overflow-hidden shrink-0">
                  {item.imagemUrl && (
                    <img
                      src={item.imagemUrl}
                      alt={item.nome}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] leading-snug line-clamp-2">
                        {item.nome}
                      </p>
                      {(item.corSelecionada || item.tamanhoSelecionado) && (
                        <p className="text-[11px] text-[#6b7280] mt-0.5">
                          {[
                            item.corSelecionada && `Cor: ${item.corSelecionada}`,
                            item.tamanhoSelecionado &&
                              `Tamanho: ${item.tamanhoSelecionado}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="shrink-0 text-[#b91c1c] p-1 -mr-1 -mt-1"
                      aria-label="Remover"
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[14px] font-bold text-[#111827]">
                      {formatBRL(item.preco * item.quantidade)}
                    </span>
                    <div className="flex items-center gap-2.5 bg-[#f4f4f5] rounded-full px-1 py-1">
                      <button
                        onClick={() =>
                          updateQuantidade(item.productId, item.quantidade - 1)
                        }
                        className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm"
                        aria-label="Diminuir"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-4 text-center text-[12px] font-semibold">
                        {item.quantidade}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantidade(item.productId, item.quantidade + 1)
                        }
                        className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm"
                        aria-label="Aumentar"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Barra fixa de resumo/checkout */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 pt-3 pb-4 safe-bottom">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-[#6b7280]">Total</span>
              <span className="text-[18px] font-extrabold text-[#111827]">
                {formatBRL(total)}
              </span>
            </div>
            <button
              onClick={() => navigate(`/loja/${store.slug}/checkout`)}
              className="w-full h-13 min-h-[52px] rounded-2xl text-white font-semibold text-[14px] active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              Finalizar pedido
            </button>
          </div>
        </>
      )}
    </div>
  );
}
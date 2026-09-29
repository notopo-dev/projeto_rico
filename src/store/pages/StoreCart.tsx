import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, X, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { chaveItem, useCart } from "../context/CartContext";
import { ProgressoFreteGratis } from "../components/FreteGratisAviso";

/**
 * O carrinho.
 *
 * Refeito no modelo de app: foto grande, preço em destaque na própria
 * linha, contador de quantidade à direita e o total DENTRO do botão.
 *
 * O total no botão não é enfeite. Antes o valor ficava numa linha
 * acima, e no celular o polegar cobria justamente essa linha na hora
 * de tocar — a pessoa confirmava sem ver quanto ia pagar.
 *
 * O frete não aparece aqui de propósito: ele depende do CEP, que só é
 * pedido no passo seguinte. Inventar um valor ou mostrar "R$ 0,00"
 * seria mentir sobre o total.
 */

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreCart() {
  const { store } = useStore();
  const { items, updateQuantidade, removeItem, clear, total, count } =
    useCart();
  const navigate = useNavigate();
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  if (!store) return null;

  return (
    <div
      className="min-h-dvh pb-40"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--store-primary) 8%, #fafafa 92%) 0px, #fafafa 220px)",
      }}
    >
      {/* Cabeçalho */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0 active:bg-[#e7e7ea]"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} className="text-[#374151]" />
        </button>

        <h1 className="flex-1 text-center text-[16px] font-bold text-[#111827]">
          Meu carrinho
        </h1>

        {/* Esvaziar fica aqui, longe dos itens: é destrutivo e pede
            confirmação. Junto da lixeira de cada item, viraria erro de
            dedo com o carrinho inteiro. */}
        {items.length > 0 ? (
          <button
            onClick={() => setConfirmandoLimpar(true)}
            className="w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0 active:bg-[#e7e7ea]"
            aria-label="Esvaziar carrinho"
          >
            <Trash2 size={17} className="text-[#6b7280]" />
          </button>
        ) : (
          <span className="w-10 shrink-0" />
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-black/5 flex items-center justify-center mb-3">
            <ShoppingBag
              size={26}
              className="text-[#d4d4d8]"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-[14px] font-semibold text-[#111827]">
            Seu carrinho está vazio
          </p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">
            Adicione produtos para continuar.
          </p>
          <button
            onClick={() => navigate(`/loja/${store.slug}`)}
            className="mt-5 h-12 px-6 rounded-full text-white text-[14px] font-semibold shadow-lg"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Ver produtos
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 space-y-2.5">
            <ProgressoFreteGratis />

            {items.map((item) => {
              // Uma LINHA do carrinho. Cor e tamanho fazem parte da
              // identidade: a mesma camisa em preto e em branco são
              // duas linhas, e mexer numa não pode mexer na outra.
              const chave = chaveItem(item);
              const variacao = [item.corSelecionada, item.tamanhoSelecionado]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={chave}
                  className="bg-white rounded-2xl border border-black/5 p-3 flex gap-3"
                >
                  <div className="w-[76px] h-[76px] rounded-xl bg-[#f4f4f5] overflow-hidden shrink-0">
                    {item.imagemUrl && (
                      <img
                        src={item.imagemUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-[#111827] leading-snug line-clamp-2">
                          {item.nome}
                        </p>
                        <p className="text-[12px] text-[#9ca3af] mt-0.5 truncate">
                          {variacao || " "}
                        </p>
                      </div>

                      <button
                        onClick={() => removeItem(chave)}
                        className="w-9 h-9 -mr-1.5 -mt-1.5 shrink-0 flex items-center justify-center rounded-full text-[#9ca3af] active:bg-[#f4f4f5] active:text-[#b91c1c]"
                        aria-label={`Remover ${item.nome}`}
                      >
                        <X size={17} strokeWidth={2.4} />
                      </button>
                    </div>

                    <div className="flex items-end justify-between gap-2 mt-1.5">
                      <span className="text-[16px] font-extrabold text-[#111827] tabular-nums">
                        {formatBRL(item.preco * item.quantidade)}
                      </span>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          onClick={() =>
                            updateQuantidade(chave, item.quantidade - 1)
                          }
                          className="w-9 h-9 rounded-full border border-[#e4e4e7] bg-white flex items-center justify-center text-[#374151] active:bg-[#f4f4f5]"
                          aria-label="Diminuir"
                        >
                          <Minus size={15} strokeWidth={2.4} />
                        </button>

                        <span className="min-w-[18px] text-center text-[14px] font-bold text-[#111827] tabular-nums">
                          {item.quantidade}
                        </span>

                        <button
                          onClick={() =>
                            updateQuantidade(chave, item.quantidade + 1)
                          }
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white active:opacity-80"
                          style={{ backgroundColor: "var(--store-primary)" }}
                          aria-label="Aumentar"
                        >
                          <Plus size={15} strokeWidth={2.6} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Valores */}
            <div className="bg-white rounded-2xl border border-black/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="text-[#6b7280]">
                  Subtotal ({count} {count === 1 ? "item" : "itens"})
                </span>
                <span className="font-semibold text-[#111827] tabular-nums">
                  {formatBRL(total)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13.5px]">
                <span className="text-[#6b7280]">Frete</span>
                <span className="text-[#9ca3af]">Calculado na entrega</span>
              </div>
            </div>
          </div>

          {/* Barra fixa */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 pt-3 pb-4 safe-bottom">
            <button
              onClick={() => navigate(`/loja/${store.slug}/checkout`)}
              className="w-full h-[54px] rounded-2xl text-white font-bold text-[15px] shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              Finalizar compra
              <span className="opacity-60">·</span>
              <span className="tabular-nums">{formatBRL(total)}</span>
            </button>
          </div>
        </>
      )}

      {/* Confirmação de esvaziar */}
      {confirmandoLimpar && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center">
          <button
            aria-label="Cancelar"
            onClick={() => setConfirmandoLimpar(false)}
            className="absolute inset-0"
          />
          <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <p className="text-[15px] font-bold text-[#111827] text-center">
              Esvaziar o carrinho?
            </p>
            <p className="mt-1.5 text-[12.5px] text-[#6b7280] text-center leading-snug">
              Os {count} {count === 1 ? "item" : "itens"} serão removidos.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => setConfirmandoLimpar(false)}
                className="flex-1 h-12 rounded-2xl border border-[#e4e4e7] bg-white text-[14px] font-semibold text-[#374151]"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  clear();
                  setConfirmandoLimpar(false);
                }}
                className="flex-1 h-12 rounded-2xl bg-[#b91c1c] text-white text-[14px] font-semibold"
              >
                Esvaziar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

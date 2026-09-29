import { ImageOff, Plus, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { PublicProduct } from "../lib/storeApi";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";

/**
 * O card da vitrine.
 *
 * Duas coisas saíram daqui:
 *
 * O coração de favoritar. Ele guardava o gosto do cliente numa
 * variável de tela: bastava trocar de página para o favorito sumir.
 * Botão que promete e não cumpre é pior do que botão nenhum — quem
 * favoritou 5 peças e voltou sem nada não confia mais na loja.
 *
 * E o botão de adicionar tinha 36px. O dedo médio de um adulto cobre
 * uns 45px; abaixo disso a pessoa erra, cai no produto sem querer, e
 * volta. Agora tem 44px, que é o mínimo que a Apple e o Google pedem.
 */

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductCard({ product }: { product: PublicProduct }) {
  const { store } = useStore();
  const { addItem } = useCart();
  const [adicionado, setAdicionado] = useState(false);

  const semEstoque =
    product.estoque <= 0 && !product.permite_venda_sem_estoque;
  const temPromo =
    product.preco_promocional != null &&
    product.preco_promocional < product.preco;

  /* Desconto em %, que é como a pessoa avalia se a oferta é boa.
     "De 120 por 89" exige conta; "-26%" não exige nada. */
  const desconto = temPromo
    ? Math.round((1 - product.preco_promocional! / product.preco) * 100)
    : 0;

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1200);
  }

  return (
    <Link
      to={`/loja/${store?.slug}/produto/${product.slug}`}
      className="block rounded-3xl bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] transition-transform"
    >
      <div className="relative aspect-square bg-gradient-to-br from-[#f4f4f5] to-[#e9e9ec]">
        {product.imagens[0] ? (
          <img
            src={product.imagens[0].url}
            alt={product.nome}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={26} className="text-[#c4c4c8]" strokeWidth={1.4} />
          </div>
        )}

        {temPromo && !semEstoque && desconto > 0 && (
          <span
            className="absolute top-2.5 left-2.5 text-[11px] font-extrabold text-white px-2.5 py-1 rounded-full shadow-sm tabular-nums"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            −{desconto}%
          </span>
        )}

        {semEstoque && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[11.5px] font-bold text-[#6b7280] bg-white px-3 py-1.5 rounded-full shadow-sm">
              Esgotado
            </span>
          </div>
        )}

        {!semEstoque && (
          <button
            onClick={handleQuickAdd}
            className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            style={{
              backgroundColor: adicionado ? "#16a34a" : "var(--store-primary)",
            }}
            aria-label={`Adicionar ${product.nome} ao carrinho`}
          >
            {adicionado ? (
              <Check size={19} strokeWidth={3} />
            ) : (
              <Plus size={19} strokeWidth={2.6} />
            )}
          </button>
        )}
      </div>

      <div className="p-3 pt-2.5">
        <p className="text-[13px] font-medium text-[#374151] leading-snug line-clamp-2 min-h-[34px]">
          {product.nome}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[17px] font-extrabold text-[#111827] tabular-nums">
            {formatBRL(product.preco_promocional ?? product.preco)}
          </span>
          {temPromo && (
            <span className="text-[11.5px] text-[#9ca3af] line-through tabular-nums">
              {formatBRL(product.preco)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

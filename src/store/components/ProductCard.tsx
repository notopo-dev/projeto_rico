import { Heart, ImageOff, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { PublicProduct } from "../lib/storeApi";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductCard({ product }: { product: PublicProduct }) {
  const { store } = useStore();
  const { addItem } = useCart();
  const [favorito, setFavorito] = useState(false);
  const [adicionado, setAdicionado] = useState(false);

  const semEstoque =
    product.estoque <= 0 && !product.permite_venda_sem_estoque;
  const temPromo =
    product.preco_promocional != null &&
    product.preco_promocional < product.preco;

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
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={26} className="text-[#c4c4c8]" strokeWidth={1.4} />
          </div>
        )}

        {temPromo && !semEstoque && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold text-white px-2 py-1 rounded-full shadow-sm"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            OFERTA
          </span>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            setFavorito((f) => !f);
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          aria-label="Favoritar"
        >
          <Heart
            size={14}
            strokeWidth={2.2}
            className={favorito ? "fill-red-500 text-red-500" : "text-[#6b7280]"}
          />
        </button>

        {semEstoque && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#6b7280] bg-white px-3 py-1.5 rounded-full shadow-sm">
              Esgotado
            </span>
          </div>
        )}

        {!semEstoque && (
          <button
            onClick={handleQuickAdd}
            className="absolute bottom-2 right-2 w-9 h-9 rounded-full text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            style={{ backgroundColor: "var(--store-primary)" }}
            aria-label="Adicionar rápido"
          >
            {adicionado ? (
              <span className="text-[13px] font-bold">✓</span>
            ) : (
              <Plus size={17} strokeWidth={2.4} />
            )}
          </button>
        )}
      </div>

      <div className="p-3">
        <p className="text-[12.5px] font-medium text-[#374151] leading-snug line-clamp-2 min-h-[32px]">
          {product.nome}
        </p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[16px] font-extrabold text-[#111827]">
            {formatBRL(product.preco_promocional ?? product.preco)}
          </span>
          {temPromo && (
            <span className="text-[11px] text-[#9ca3af] line-through">
              {formatBRL(product.preco)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
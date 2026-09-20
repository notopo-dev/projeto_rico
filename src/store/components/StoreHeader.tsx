import { Search, ShoppingBag, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";

interface StoreHeaderProps {
  onSearchClick?: () => void;
}

export default function StoreHeader({ onSearchClick }: StoreHeaderProps) {
  const { store } = useStore();
  const { count } = useCart();

  if (!store) return null;

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b border-black/5"
      style={{ backgroundColor: "color-mix(in srgb, var(--store-primary) 12%, white 88%)" }}
    >
      <div className="px-4 pt-4 pb-3.5 flex items-center gap-3">
        <Link
          to={`/loja/${store.slug}`}
          className="flex items-center gap-3 min-w-0 flex-1"
        >
          {store.logo_url ? (
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-white shadow-sm ring-1 ring-black/[0.04]">
              <img
                src={store.logo_url}
                alt={store.nome}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          <div className="min-w-0">
            <h1 className="text-[19px] font-extrabold text-[#111827] truncate leading-tight">
              {store.nome}
            </h1>
            <p className="text-[12.5px] font-medium leading-tight" style={{ color: "var(--store-primary)" }}>
              Ver loja
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center text-[#374151] active:scale-95 transition-transform shadow-sm"
              aria-label="Buscar"
            >
              <Search size={21} strokeWidth={2} />
            </button>
          )}

          <Link
            to={`/loja/${store.slug}/meus-pedidos`}
            className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center text-[#374151] active:scale-95 transition-transform shadow-sm"
            aria-label="Meus pedidos"
          >
            <Receipt size={21} strokeWidth={2} />
          </Link>

          <Link
            to={`/loja/${store.slug}/carrinho`}
            className="relative w-12 h-12 rounded-full bg-white/80 flex items-center justify-center text-[#374151] active:scale-95 transition-transform shadow-sm"
            aria-label="Carrinho"
          >
            <ShoppingBag size={21} strokeWidth={2} />
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                style={{ backgroundColor: "var(--store-primary)" }}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
import { useEffect, useState } from "react";
import { Loader2, Search, PackageX, Sparkles } from "lucide-react";
import { useStore } from "../context/StoreContext";
import StoreHeader from "../components/StoreHeader";
import CategoryPills from "../components/CategoryPills";
import ProductCard from "../components/ProductCard";
import {
  listPublicCategories,
  listPublicProducts,
  type PublicCategory,
  type PublicProduct,
} from "../lib/storeApi";

export default function StoreHome() {
  const { store, loading: loadingStore, error: storeError } = useStore();

  const [categorias, setCategorias] = useState<PublicCategory[]>([]);
  const [produtos, setProdutos] = useState<PublicProduct[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(
    null
  );
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let mounted = true;

    setLoading(true);
    Promise.all([
      listPublicCategories(store.id),
      listPublicProducts(store.id),
    ])
      .then(([cats, prods]) => {
        if (!mounted) return;
        setCategorias(cats);
        setProdutos(prods);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar produtos."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [store]);

  if (loadingStore) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-[#9ca3af]" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white px-6 text-center">
        <PackageX size={40} className="text-[#d4d4d8] mb-3" strokeWidth={1.5} />
        <p className="text-[15px] font-semibold text-[#111827]">
          Loja não encontrada
        </p>
        <p className="mt-1 text-[13px] text-[#9ca3af]">
          Verifique se o endereço está correto.
        </p>
      </div>
    );
  }

  const produtosFiltrados = produtos.filter((p) => {
    const matchCategoria =
      !categoriaSelecionada || p.category_id === categoriaSelecionada;
    const matchBusca =
      !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  });

  const emDestaque = produtos
    .filter((p) => p.preco_promocional != null && p.preco_promocional < p.preco)
    .slice(0, 6);

  return (
    <div
      className="min-h-dvh pb-28"
      style={{ backgroundColor: "#f6f6f8" }}
    >
      <StoreHeader onSearchClick={() => setBuscaAberta((v) => !v)} />

      {buscaAberta && (
        <div className="px-4 py-2.5 bg-white border-b border-black/5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            />
            <input
              autoFocus
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar em ${store.nome}...`}
              className="w-full h-12 pl-10 pr-3 rounded-2xl bg-[#f4f4f5] text-[14px] outline-none placeholder:text-[#9ca3af]"
            />
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="px-4 pt-3">
        {store.banner_url ? (
          <div className="relative rounded-3xl overflow-hidden aspect-[16/8] shadow-sm">
            <img
              src={store.banner_url}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white text-[15px] font-bold drop-shadow">
                {store.nome}
              </p>
              {store.descricao && (
                <p className="text-white/90 text-[11.5px] mt-0.5 line-clamp-1 drop-shadow">
                  {store.descricao}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div
            className="relative rounded-3xl overflow-hidden aspect-[16/7] flex items-end p-4"
            style={{
              background: `linear-gradient(135deg, var(--store-primary), var(--store-secondary))`,
            }}
          >
            <div>
              <p className="text-white text-[16px] font-extrabold">
                {store.nome}
              </p>
              {store.descricao && (
                <p className="text-white/85 text-[12px] mt-0.5 line-clamp-2 max-w-[85%]">
                  {store.descricao}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {categorias.length > 0 && (
        <CategoryPills
          categorias={categorias}
          selecionada={categoriaSelecionada}
          onSelect={setCategoriaSelecionada}
        />
      )}

      {/* Destaques / ofertas */}
      {!categoriaSelecionada && !busca && emDestaque.length > 0 && (
        <div className="pt-1 pb-2">
          <div className="px-4 flex items-center gap-1.5 mb-2.5">
            <Sparkles size={15} style={{ color: "var(--store-primary)" }} />
            <h2 className="text-[14px] font-bold text-[#111827]">Ofertas</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {emDestaque.map((p) => (
              <div key={p.id} className="w-[42vw] max-w-[168px] shrink-0">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-2">
        {(categoriaSelecionada || busca || emDestaque.length === 0) && (
          <h2 className="text-[14px] font-bold text-[#111827] mb-2.5">
            {categoriaSelecionada
              ? categorias.find((c) => c.id === categoriaSelecionada)?.nome
              : "Produtos"}
          </h2>
        )}
        {!categoriaSelecionada && !busca && emDestaque.length > 0 && (
          <h2 className="text-[14px] font-bold text-[#111827] mb-2.5">
            Todos os produtos
          </h2>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[#9ca3af]" />
          </div>
        ) : error ? (
          <div className="py-10 text-center text-[13px] text-[#b91c1c]">
            {error}
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <PackageX
              size={32}
              className="mx-auto text-[#d4d4d8] mb-2"
              strokeWidth={1.5}
            />
            <p className="text-[13px] text-[#9ca3af]">
              Nenhum produto encontrado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {produtosFiltrados.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, ShoppingBag, Loader2, ImageOff, Minus, Plus } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import {
  getPublicProductBySlug,
  type PublicProduct,
  type PublicProductColor,
} from "../lib/storeApi";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreProduct() {
  const { store } = useStore();
  const { productSlug } = useParams<{ productSlug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Índice da imagem ativa DENTRO de product.imagens. Quando a cor
  // selecionada tem uma imagem própria, ela é exibida por cima
  // (imagemCorAtiva), sem depender desse índice.
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [imagemCorAtiva, setImagemCorAtiva] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const [corSelecionada, setCorSelecionada] = useState<PublicProductColor | null>(
    null
  );
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");
  const [inicioToque, setInicioToque] = useState(0);

  useEffect(() => {
    if (!store || !productSlug) return;
    let mounted = true;

    setLoading(true);
    getPublicProductBySlug(store.id, productSlug)
      .then((data) => {
        if (!mounted) return;
        setProduct(data);
        setCorSelecionada(data?.cores?.[0] ?? null);
        setImagemCorAtiva(data?.cores?.[0]?.imagem_url ?? null);
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Erro ao carregar produto.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [store, productSlug]);

  function selecionarCor(cor: PublicProductColor) {
    setCorSelecionada(cor);
    // Cor com imagem própria: mostra ela por cima da galeria.
    // Cor sem imagem própria: volta pra galeria normal do produto.
    setImagemCorAtiva(cor.imagem_url ?? null);
  }

  function trocarImagemSwipe(e: React.TouchEvent) {
    if (!product) return;
    const fim = e.changedTouches[0].clientX;
    const diferenca = inicioToque - fim;

    if (Math.abs(diferenca) < 50) return;

    // Qualquer swipe manual sai do modo "imagem da cor" e volta
    // para navegar pela galeria normal do produto.
    setImagemCorAtiva(null);

    if (diferenca > 0 && imagemAtiva < product.imagens.length - 1) {
      setImagemAtiva((i) => i + 1);
    }
    if (diferenca < 0 && imagemAtiva > 0) {
      setImagemAtiva((i) => i - 1);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-[#9ca3af]" />
      </div>
    );
  }

  if (error || !product || !store) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-[14px] text-[#9ca3af]">
          {error ?? "Produto não encontrado."}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-3 text-[13px] font-semibold"
          style={{ color: "var(--store-primary)" }}
        >
          Voltar
        </button>
      </div>
    );
  }

  const semEstoque = product.estoque <= 0 && !product.permite_venda_sem_estoque;
  const temPromo =
    product.preco_promocional != null && product.preco_promocional < product.preco;
  const precoFinal = product.preco_promocional ?? product.preco;

  // Qual imagem exibir agora: a da cor selecionada (se houver) ou
  // a da galeria normal do produto.
  const imagemExibida = imagemCorAtiva ?? product.imagens[imagemAtiva]?.url ?? null;

  function handleAdicionar() {
    if (!product) return;
    addItem(product, quantidade, {
      imagemUrl: imagemExibida,
      corSelecionada: corSelecionada?.nome,
      tamanhoSelecionado: tamanhoSelecionado || undefined,
    });
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1500);
  }

  function handleComprarAgora() {
    if (!product) return;
    addItem(product, quantidade, {
      imagemUrl: imagemExibida,
      corSelecionada: corSelecionada?.nome,
      tamanhoSelecionado: tamanhoSelecionado || undefined,
    });
    navigate(`/loja/${store.slug}/carrinho`);
  }

  return (
    <div className="min-h-dvh bg-white pb-28">
      {/* Topo com voltar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft size={19} className="text-[#374151]" />
        </button>
        <Link
          to={`/loja/${store.slug}/carrinho`}
          className="ml-auto w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Carrinho"
        >
          <ShoppingBag size={17} className="text-[#374151]" />
        </Link>
      </div>

      {/* Galeria */}
      <div
        className="aspect-square bg-[#f4f4f5] relative"
        onTouchStart={(e) => setInicioToque(e.touches[0].clientX)}
        onTouchEnd={trocarImagemSwipe}
      >
        {imagemExibida ? (
          <img
            key={imagemExibida}
            src={imagemExibida}
            alt={product.nome}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={40} className="text-[#d4d4d8]" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {product.imagens.length > 1 && (
        <div className="px-4 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {product.imagens.map((img, i) => (
            <button
              key={i}
              onClick={() => {
                setImagemCorAtiva(null);
                setImagemAtiva(i);
              }}
              className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 ${
                !imagemCorAtiva && i === imagemAtiva
                  ? "border-[var(--store-primary)]"
                  : "border-transparent"
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="px-4 pt-3">
        {product.categoria_nome && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            {product.categoria_nome}
          </p>
        )}
        <h1 className="mt-1 text-[19px] font-bold text-[#111827] leading-snug">
          {product.nome}
        </h1>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[24px] font-extrabold text-[#111827]">
            {formatBRL(precoFinal)}
          </span>
          {temPromo && (
            <span className="text-[14px] text-[#9ca3af] line-through">
              {formatBRL(product.preco)}
            </span>
          )}
        </div>

        {semEstoque ? (
          <p className="mt-2 text-[12px] font-semibold text-[#b91c1c]">
            Produto esgotado
          </p>
        ) : product.estoque > 0 && product.estoque <= 5 ? (
          <p className="mt-2 text-[12px] font-medium text-[#b45309]">
            Últimas {product.estoque} unidades
          </p>
        ) : null}

        {product.descricao && (
          <p className="mt-5 p-3 rounded-2xl bg-[#f8f8f8] text-[13px] leading-relaxed text-[#4b5563] whitespace-pre-line">
            {product.descricao}
          </p>
        )}

        {product.cores?.length > 0 && (
          <div className="mt-5">
            <p className="text-[13px] font-medium mb-2">Cor</p>
            <div className="flex flex-wrap gap-2">
              {product.cores.map((cor) => (
                <button
                  key={cor.id ?? cor.nome}
                  onClick={() => selecionarCor(cor)}
                  className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-[13px] transition-colors ${
                    corSelecionada?.nome === cor.nome
                      ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                      : "border-[#e4e4e7]"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10"
                    style={{ backgroundColor: cor.codigo_hex ?? "#e4e4e7" }}
                  />
                  {cor.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.tamanhos?.length > 0 && (
          <div className="mt-5">
            <p className="text-[13px] font-medium mb-2">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {product.tamanhos.map((t) => (
                <button
                  key={t.id ?? t.tamanho}
                  onClick={() => setTamanhoSelecionado(t.tamanho)}
                  className={`px-4 py-2 rounded-xl border text-[13px] font-medium transition-colors ${
                    tamanhoSelecionado === t.tamanho
                      ? "text-white border-transparent"
                      : "border-[#e4e4e7] text-[#374151]"
                  }`}
                  style={
                    tamanhoSelecionado === t.tamanho
                      ? { backgroundColor: "var(--store-primary)" }
                      : undefined
                  }
                >
                  {t.tamanho}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantidade */}
        {!semEstoque && (
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[13px] font-medium text-[#374151]">
              Quantidade
            </span>
            <div className="flex items-center gap-3 bg-[#f4f4f5] rounded-full px-1 py-1">
              <button
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"
                aria-label="Diminuir"
              >
                <Minus size={14} />
              </button>
              <span className="w-6 text-center text-[14px] font-semibold">
                {quantidade}
              </span>
              <button
                onClick={() => setQuantidade((q) => q + 1)}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"
                aria-label="Aumentar"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra fixa de ação */}
      {!semEstoque && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-3 flex gap-2.5 safe-bottom">
          <button
            onClick={handleAdicionar}
            className="flex-1 h-13 min-h-[52px] rounded-2xl border-2 font-semibold text-[14px] active:scale-[0.98] transition-transform"
            style={{
              borderColor: "var(--store-primary)",
              color: "var(--store-primary)",
            }}
          >
            {adicionado ? "Adicionado ✓" : "Adicionar"}
          </button>
          <button
            onClick={handleComprarAgora}
            className="flex-1 h-13 min-h-[52px] rounded-2xl text-white font-semibold text-[14px] active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Comprar agora
          </button>
        </div>
      )}
    </div>
  );
}
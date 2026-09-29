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
  const [descricaoAberta, setDescricaoAberta] = useState(false);

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

  const desconto = temPromo
    ? Math.round((1 - precoFinal / product.preco) * 100)
    : 0;

  const descricaoLonga = (product.descricao ?? "").length > 180;

  return (
    <div className="min-h-dvh bg-white pb-32">
      {/* Foto ocupando o topo inteiro.
          Os controles flutuam por cima em vez de morarem numa barra:
          num celular, a foto é o que vende, e uma barra branca em cima
          rouba os primeiros 56px da tela logo na chegada. */}
      <div
        className="relative aspect-[4/5] bg-[#f4f4f5]"
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

        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} className="text-[#374151]" />
        </button>

        <Link
          to={`/loja/${store.slug}/carrinho`}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          aria-label="Carrinho"
        >
          <ShoppingBag size={18} className="text-[#374151]" />
        </Link>

        {product.imagens.length > 1 && (
          <span className="absolute bottom-4 right-4 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur text-white text-[11.5px] font-semibold tabular-nums">
            {(imagemCorAtiva ? 0 : imagemAtiva) + 1}/{product.imagens.length}
          </span>
        )}

        {semEstoque && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-[13px] font-bold text-[#6b7280] bg-white px-4 py-2 rounded-full shadow-sm">
              Esgotado
            </span>
          </div>
        )}
      </div>

      {product.imagens.length > 1 && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto no-scrollbar">
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
                  : "border-[#e4e4e7]"
              }`}
              aria-label={`Foto ${i + 1}`}
            >
              <img
                src={img.url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Quem está vendendo */}
      <div className="px-4 pt-4 flex items-center gap-2.5">
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt=""
            className="w-7 h-7 rounded-full object-cover ring-1 ring-black/5 shrink-0"
          />
        ) : (
          <span
            className="w-7 h-7 rounded-full shrink-0"
            style={{ backgroundColor: "var(--store-primary)" }}
          />
        )}
        <span className="text-[13.5px] font-bold text-[#111827] truncate">
          {store.nome}
        </span>
        <Link
          to={`/loja/${store.slug}`}
          className="ml-auto text-[12.5px] font-semibold shrink-0"
          style={{ color: "var(--store-primary)" }}
        >
          Ver loja
        </Link>
      </div>

      {/* Nome e preço */}
      <div className="px-4 pt-2.5">
        {product.categoria_nome && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            {product.categoria_nome}
          </p>
        )}
        <h1 className="mt-0.5 text-[20px] font-bold text-[#111827] leading-snug">
          {product.nome}
        </h1>

        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span
            className="text-[26px] font-extrabold tabular-nums"
            style={{ color: "var(--store-primary)" }}
          >
            {formatBRL(precoFinal)}
          </span>
          {temPromo && (
            <>
              <span className="text-[14px] text-[#9ca3af] line-through tabular-nums">
                {formatBRL(product.preco)}
              </span>
              {desconto > 0 && (
                <span className="text-[11.5px] font-extrabold text-white px-2 py-0.5 rounded-full bg-[#dc2626] tabular-nums">
                  −{desconto}%
                </span>
              )}
            </>
          )}

          {/* No lugar de "10 mil vendidos", o que a loja sabe de
              verdade: quantas peças restam. Número inventado de vendas
              é propaganda falsa, e o cliente descobre. */}
          {!semEstoque && product.estoque > 0 && product.estoque <= 5 && (
            <span className="ml-auto text-[12px] font-semibold text-[#b45309]">
              Últimas {product.estoque}
            </span>
          )}
        </div>

        {semEstoque && (
          <p className="mt-2 text-[12.5px] font-semibold text-[#b91c1c]">
            Produto esgotado
          </p>
        )}
      </div>

      {/* Tamanho */}
      {product.tamanhos?.length > 0 && (
        <div className="px-4 mt-5">
          <p className="text-[13.5px] font-bold text-[#111827] mb-2">Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {product.tamanhos.map((t) => {
              const ativo = tamanhoSelecionado === t.tamanho;
              return (
                <button
                  key={t.id ?? t.tamanho}
                  onClick={() => setTamanhoSelecionado(t.tamanho)}
                  aria-pressed={ativo}
                  className={`min-w-[48px] h-12 px-3.5 rounded-full border-2 text-[14px] font-semibold transition-colors ${
                    ativo
                      ? "text-white border-transparent shadow-sm"
                      : "border-[#e4e4e7] text-[#374151] bg-white"
                  }`}
                  style={
                    ativo
                      ? { backgroundColor: "var(--store-primary)" }
                      : undefined
                  }
                >
                  {t.tamanho}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cor */}
      {product.cores?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-[13.5px] font-bold text-[#111827]">Cor</p>
            {corSelecionada && (
              <span className="text-[12.5px] text-[#6b7280]">
                {corSelecionada.nome}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {product.cores.map((cor) => {
              const ativo = corSelecionada?.nome === cor.nome;
              return (
                <button
                  key={cor.id ?? cor.nome}
                  onClick={() => selecionarCor(cor)}
                  aria-pressed={ativo}
                  aria-label={cor.nome}
                  title={cor.nome}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${
                    ativo ? "scale-105" : ""
                  }`}
                  style={{
                    boxShadow: ativo
                      ? "0 0 0 2px var(--store-primary)"
                      : "0 0 0 1px #e4e4e7",
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-full border border-black/10"
                    style={{
                      backgroundColor: cor.codigo_hex ?? "#e4e4e7",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Descrição */}
      {product.descricao && (
        <div className="px-4 mt-5">
          <p className="text-[13.5px] font-bold text-[#111827] mb-1.5">
            Descrição
          </p>
          <p
            className={`text-[13.5px] leading-relaxed text-[#4b5563] whitespace-pre-line ${
              descricaoLonga && !descricaoAberta ? "line-clamp-3" : ""
            }`}
          >
            {product.descricao}
          </p>
          {descricaoLonga && (
            <button
              onClick={() => setDescricaoAberta((v) => !v)}
              className="mt-1 text-[13px] font-semibold"
              style={{ color: "var(--store-primary)" }}
            >
              {descricaoAberta ? "Ler menos" : "Ler mais"}
            </button>
          )}
        </div>
      )}

      {/* Quantidade */}
      {!semEstoque && (
        <div className="px-4 mt-5 flex items-center justify-between">
          <span className="text-[13.5px] font-bold text-[#111827]">
            Quantidade
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full border border-[#e4e4e7] bg-white flex items-center justify-center text-[#374151] active:bg-[#f4f4f5]"
              aria-label="Diminuir"
            >
              <Minus size={15} strokeWidth={2.4} />
            </button>
            <span className="min-w-[20px] text-center text-[15px] font-bold text-[#111827] tabular-nums">
              {quantidade}
            </span>
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white active:opacity-80"
              style={{ backgroundColor: "var(--store-primary)" }}
              aria-label="Aumentar"
            >
              <Plus size={15} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {/* Barra fixa de ação */}
      {!semEstoque && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-3 flex gap-2.5 safe-bottom">
          {/* "Comprar agora" é o caminho que a loja quer, então é o
              maior e o colorido. Dois botões do mesmo tamanho fazem a
              pessoa parar para escolher. */}
          <button
            onClick={handleAdicionar}
            className="h-[52px] px-4 rounded-2xl border-2 font-semibold text-[14px] active:scale-[0.98] transition-transform shrink-0"
            style={{
              borderColor: "var(--store-primary)",
              color: "var(--store-primary)",
            }}
          >
            {adicionado ? "Adicionado" : "Adicionar"}
          </button>
          <button
            onClick={handleComprarAgora}
            className="flex-1 h-[52px] rounded-2xl text-white font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            Comprar agora
          </button>
        </div>
      )}
    </div>
  );
}

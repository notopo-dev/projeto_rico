import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, ShoppingBag, Loader2, ImageOff, Minus, Plus } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import {
  getPublicProductBySlug,
  type PublicProduct,
  type PublicProductColor,
} from "../lib/storeApi";
import { montarGrade } from "../lib/grade";

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
  /**
   * No modo grade quem manda é o NOME da cor, não o objeto de
   * product_colors — a cor da grade vem de product_variants, que é
   * outra tabela. As duas convivem: produto sem grade continua
   * usando corSelecionada, como sempre.
   */
  const [corGrade, setCorGrade] = useState<string | null>(null);
  const [inicioToque, setInicioToque] = useState(0);
  const [descricaoAberta, setDescricaoAberta] = useState(false);

  // Antes de qualquer `return` condicional: hook não pode ficar
  // atrás de if. montarGrade aguenta null, então roda carregando.
  const grade = useMemo(() => montarGrade(product?.variacoes), [product]);

  useEffect(() => {
    if (!store || !productSlug) return;
    let mounted = true;

    setLoading(true);
    getPublicProductBySlug(store.id, productSlug)
      .then((data) => {
        if (!mounted) return;
        setProduct(data);

        const g = montarGrade(data?.variacoes);
        const livre = data?.permite_venda_sem_estoque ?? false;

        if (g.usa) {
          // Já abre na primeira combinação que dá para comprar, em
          // vez de na primeira da lista. Abrir numa cor esgotada faz
          // o produto parecer indisponível na primeira olhada.
          const cor = g.primeiraCorBoa(livre);
          setCorGrade(cor?.nome ?? null);
          setImagemCorAtiva(cor?.imagem ?? null);
          setTamanhoSelecionado(
            cor
              ? g.primeiroTamanhoBom(cor.nome, livre) ?? ""
              : g.tamanhos.find((t) => g.disponivel(null, t, livre)) ?? ""
          );
        } else {
          setCorSelecionada(data?.cores?.[0] ?? null);
          setImagemCorAtiva(data?.cores?.[0]?.imagem_url ?? null);
        }
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

  /**
   * Troca a cor da grade e, se o tamanho escolhido não existir ou
   * tiver acabado nessa cor, pula para o primeiro que serve.
   *
   * Sem isto, escolher "Vermelho" com "GG" selecionado deixaria a
   * tela numa combinação morta e o botão desligado, sem o cliente
   * entender o que fez de errado.
   */
  function selecionarCorDaGrade(
    nome: string,
    imagem: string | null,
    g: ReturnType<typeof montarGrade>,
    vendeSemEstoque: boolean
  ) {
    setCorGrade(nome);
    setImagemCorAtiva(imagem);
    setQuantidade(1);

    if (!g.disponivel(nome, tamanhoSelecionado || null, vendeSemEstoque)) {
      setTamanhoSelecionado(g.primeiroTamanhoBom(nome, vendeSemEstoque) ?? "");
    }
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

  const livre = product.permite_venda_sem_estoque;

  // Qual cor e tamanho valem agora. Com grade, a cor vem do nome;
  // sem grade, do objeto antigo de product_colors.
  const corAtual = grade.usa ? corGrade : corSelecionada?.nome ?? null;
  const tamAtual = tamanhoSelecionado || null;

  // A gaveta exata que o cliente escolheu. null = ainda não escolheu,
  // ou escolheu uma combinação que não existe na grade.
  const variacao = grade.usa ? grade.achar(corAtual, tamAtual) : null;

  /**
   * Duas perguntas diferentes, que antes eram uma só:
   *
   *   tudoEsgotado  — o produto INTEIRO acabou? Manda na tarja da
   *                   foto e em esconder a barra de comprar.
   *   podeComprar   — a combinação escolhida AGORA dá para comprar?
   *                   Manda nos botões.
   *
   * Com 3 cores e duas esgotadas, o produto continua à venda: quem
   * some é a cor. Tratar os dois como a mesma coisa era o que fazia
   * o cliente escolher "P preta" sem pista nenhuma de que acabou.
   */
  const tudoEsgotado = grade.usa
    ? !grade.temAlgoAVenda(livre)
    : product.estoque <= 0 && !livre;

  const podeComprar = grade.usa
    ? grade.disponivel(corAtual, tamAtual, livre)
    : !tudoEsgotado;

  const faltaEscolher = grade.usa && !variacao;

  // Mantido: o resto do arquivo lê `semEstoque` para esconder a
  // barra e marcar a foto, e esse é o sentido antigo do nome.
  const semEstoque = tudoEsgotado;

  // Preço da gaveta ganha do preço do produto — é o que o servidor
  // cobra (criar_pedido_publico lê product_variants.preco).
  const precoVariacao = variacao?.preco ?? null;
  const temPromo =
    precoVariacao == null &&
    product.preco_promocional != null &&
    product.preco_promocional < product.preco;
  const precoFinal = precoVariacao ?? product.preco_promocional ?? product.preco;

  // Quantas peças daquela gaveta. Sem grade, o número do produto.
  const estoqueVisivel = grade.usa ? variacao?.estoque ?? null : product.estoque;

  // Teto do seletor de quantidade: não deixa pedir mais do que existe,
  // em vez de deixar o servidor recusar no fim do checkout.
  const maximo =
    livre || estoqueVisivel == null ? Infinity : Math.max(estoqueVisivel, 1);

  // Qual imagem exibir agora: a da cor selecionada (se houver) ou
  // a da galeria normal do produto.
  const imagemExibida = imagemCorAtiva ?? product.imagens[imagemAtiva]?.url ?? null;

  // Um lugar só para montar o item: duas cópias divergiriam na
  // primeira mudança, e aí "Adicionar" e "Comprar agora" mandariam
  // coisas diferentes para o carrinho.
  function opcoesDoItem() {
    return {
      imagemUrl: imagemExibida,
      corSelecionada: corAtual ?? undefined,
      tamanhoSelecionado: tamanhoSelecionado || undefined,
      // Preço da gaveta, quando ela tem preço próprio.
      precoUnitario: precoVariacao,
    };
  }

  function handleAdicionar() {
    if (!product || !podeComprar) return;
    addItem(product, quantidade, opcoesDoItem());
    setAdicionado(true);
    setTimeout(() => setAdicionado(false), 1500);
  }

  function handleComprarAgora() {
    if (!product || !podeComprar) return;
    addItem(product, quantidade, opcoesDoItem());
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
          to={`/loja/${store.slug}/sobre`}
          className="ml-auto text-[12.5px] font-semibold shrink-0"
          style={{ color: "var(--store-primary)" }}
        >
          Sobre a loja
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
          {/* O número é da COMBINAÇÃO escolhida, não do produto. Dizer
              "últimas 3" somando 3 cores é promessa que a loja não
              cumpre: pode não ter nenhuma da cor que a pessoa quer. */}
          {!semEstoque &&
            estoqueVisivel != null &&
            estoqueVisivel > 0 &&
            estoqueVisivel <= 5 && (
              <span className="ml-auto text-[12px] font-semibold text-[#b45309]">
                {grade.usa ? "Última" + (estoqueVisivel > 1 ? "s" : "") : "Últimas"}{" "}
                {estoqueVisivel}
              </span>
            )}
        </div>

        {semEstoque && (
          <p className="mt-2 text-[12.5px] font-semibold text-[#b91c1c]">
            Produto esgotado
          </p>
        )}

        {/* Avisos da grade, só quando o produto inteiro NÃO acabou */}
        {!semEstoque && grade.usa && faltaEscolher && (
          <p className="mt-2 text-[12.5px] font-semibold text-[#6b7280]">
            {grade.cores.length > 0 && grade.tamanhos.length > 0
              ? "Escolha a cor e o tamanho"
              : grade.tamanhos.length > 0
                ? "Escolha o tamanho"
                : "Escolha a cor"}
          </p>
        )}

        {!semEstoque && grade.usa && !faltaEscolher && !podeComprar && (
          <p className="mt-2 text-[12.5px] font-semibold text-[#b91c1c]">
            Esta combinação acabou. Experimente outra cor ou tamanho.
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------
          Tamanho

          Com grade, cada botão sabe se aquela combinação EXISTE e se
          TEM peça — duas coisas diferentes, mostradas diferente:

            não existe  → bem apagado, riscado  ("Vermelho não sai em GG")
            esgotou     → meio apagado, riscado ("saiu, mas acabou")

          Juntar as duas num "indisponível" só esconderia do cliente
          por que ele não pode comprar.
      ---------------------------------------------------------- */}
      {grade.usa && grade.tamanhos.length > 0 && (
        <div className="px-4 mt-5">
          <p className="text-[13.5px] font-bold text-[#111827] mb-2">Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {grade.tamanhos.map((t) => {
              const ativo = tamanhoSelecionado === t;
              const existe = grade.estoqueDe(corAtual, t) !== null;
              const da = grade.disponivel(corAtual, t, livre);

              return (
                <button
                  key={t}
                  type="button"
                  disabled={!da}
                  onClick={() => {
                    setTamanhoSelecionado(t);
                    setQuantidade(1);
                  }}
                  aria-pressed={ativo}
                  title={
                    !existe
                      ? "Não sai nesta cor"
                      : !da
                        ? "Esgotado nesta cor"
                        : undefined
                  }
                  className={`min-w-[48px] h-12 px-3.5 rounded-full border-2 text-[14px] font-semibold transition-colors ${
                    ativo && da
                      ? "text-white border-transparent shadow-sm"
                      : da
                        ? "border-[#e4e4e7] text-[#374151] bg-white"
                        : existe
                          ? "border-[#f4f4f5] text-[#9ca3af] bg-[#fafafa] line-through cursor-not-allowed"
                          : "border-[#f4f4f5] text-[#d4d4d8] bg-[#fafafa] line-through cursor-not-allowed"
                  }`}
                  style={
                    ativo && da
                      ? { backgroundColor: "var(--store-primary)" }
                      : undefined
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tamanho — produto sem grade, exatamente como era antes */}
      {!grade.usa && product.tamanhos?.length > 0 && (
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

      {/* Cor — com grade, a cor sem nenhuma peça fica apagada */}
      {grade.usa && grade.cores.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-[13.5px] font-bold text-[#111827]">Cor</p>
            {corAtual && (
              <span className="text-[12.5px] text-[#6b7280]">{corAtual}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {grade.cores.map((cor) => {
              const ativo = corAtual === cor.nome;
              const tem = grade.corTemAlgo(cor.nome, livre);

              return (
                <button
                  key={cor.nome}
                  type="button"
                  disabled={!tem}
                  onClick={() =>
                    selecionarCorDaGrade(cor.nome, cor.imagem, grade, livre)
                  }
                  aria-pressed={ativo}
                  aria-label={tem ? cor.nome : `${cor.nome} (esgotada)`}
                  title={tem ? cor.nome : `${cor.nome} — esgotada`}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-transform ${
                    ativo ? "scale-105" : ""
                  } ${tem ? "" : "opacity-40 cursor-not-allowed"}`}
                  style={{
                    boxShadow: ativo
                      ? "0 0 0 2px var(--store-primary)"
                      : "0 0 0 1px #e4e4e7",
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-full border border-black/10"
                    style={{ backgroundColor: cor.hex ?? "#e4e4e7" }}
                  />
                  {/* Risco na diagonal: a bolinha de cor não tem onde
                      escrever "esgotado", e só apagar fica ambíguo com
                      uma cor clara. */}
                  {!tem && (
                    <span
                      aria-hidden
                      className="absolute w-[34px] h-[1.5px] bg-[#6b7280] rotate-45 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cor — produto sem grade, exatamente como era antes */}
      {!grade.usa && product.cores?.length > 0 && (
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
            {/* Trava no que existe na gaveta, em vez de deixar pedir
                10 e o servidor recusar no fim do checkout. */}
            <button
              onClick={() => setQuantidade((q) => Math.min(maximo, q + 1))}
              disabled={quantidade >= maximo}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white active:opacity-80 disabled:opacity-40"
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
            disabled={!podeComprar}
            className="h-[52px] px-4 rounded-2xl border-2 font-semibold text-[14px] active:scale-[0.98] transition-transform shrink-0 disabled:opacity-40 disabled:active:scale-100"
            style={{
              borderColor: "var(--store-primary)",
              color: "var(--store-primary)",
            }}
          >
            {adicionado ? "Adicionado" : "Adicionar"}
          </button>
          <button
            onClick={handleComprarAgora}
            disabled={!podeComprar}
            className="flex-1 h-[52px] rounded-2xl text-white font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {/* O botão diz o que falta, em vez de só ficar cinza e
                deixar o cliente procurando o motivo. */}
            {faltaEscolher
              ? grade.tamanhos.length > 0 && grade.cores.length > 0
                ? "Escolha cor e tamanho"
                : grade.tamanhos.length > 0
                  ? "Escolha o tamanho"
                  : "Escolha a cor"
              : podeComprar
                ? "Comprar agora"
                : "Combinação esgotada"}
          </button>
        </div>
      )}
    </div>
  );
}

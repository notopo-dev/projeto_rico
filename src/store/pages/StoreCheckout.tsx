import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  MessageCircle,
  CreditCard,
  Landmark,
  QrCode,
  Loader2,
  Truck,
  UserCheck,
  Store as StoreIcon,
  Home,
  User,
  Check,
  Lock,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import { createPublicOrder, type EnderecoEntrega } from "../lib/storeApi";
import { calcularFrete, type OpcaoFrete } from "../lib/freteApi";
import StripeCardPayment from "../components/StripeCardPayment";
import {
  lerComprador,
  limparComprador,
  salvarComprador,
} from "../lib/compradorLocal";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function descricaoVariacao(
  corSelecionada?: string,
  tamanhoSelecionado?: string,
) {
  return [
    corSelecionada && `Cor: ${corSelecionada}`,
    tamanhoSelecionado && `Tamanho: ${tamanhoSelecionado}`,
  ]
    .filter(Boolean)
    .join(", ");
}

type Etapa = "dados" | "pagamento";

const estadosBR = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function formatarCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

async function buscarCep(cep: string) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}

/** O que o cliente escolhe na tela. */
type Metodo = "whatsapp" | "pix" | "credito" | "debito";

/** Crédito e débito seguem o mesmo caminho de cobrança. */
function ehCartao(m: Metodo) {
  return m === "credito" || m === "debito";
}

/**
 * Da escolha da tela para o que fica gravado no pedido.
 * WhatsApp não é forma de pagamento — é combinar por fora, e por isso
 * grava nulo.
 */
const METODO_NO_BANCO: Record<
  Metodo,
  "pix" | "cartao_credito" | "cartao_debito" | null
> = {
  whatsapp: null,
  pix: "pix",
  credito: "cartao_credito",
  debito: "cartao_debito",
};

/**
 * Uma opção de entrega já pronta para a tela, venha ela de onde vier:
 * da tabela das transportadoras, do valor fixo da loja, do frete
 * grátis ou da retirada no balcão.
 *
 * Antes a tela falava direto em `OpcaoFrete` do Melhor Envio — e por
 * isso quem não tinha conta lá simplesmente não tinha frete. Este tipo
 * é o que permite as outras formas existirem sem espalhar "se for
 * Melhor Envio faz assim, senão assado" por toda a tela.
 */
interface OpcaoEntrega {
  chave: string;
  nome: string;
  transportadora: string;
  preco: number;
  prazoDias: number | null;
  /** Só a tabela das transportadoras tem: é o que compra a etiqueta. */
  servicoId: number | null;
}

function textoPrazo(dias: number | null) {
  if (dias === null || dias <= 0) return null;
  return `Até ${dias} dia${dias !== 1 ? "s" : ""} úte${dias !== 1 ? "is" : "il"}`;
}

/**
 * Barra de passos.
 *
 * O checkout era uma página só, com dados, endereço, frete, forma de
 * pagamento e resumo empilhados. No celular isso vira uma rolagem
 * longa sem fim à vista, e é onde a maioria desiste: a pessoa não sabe
 * quanto falta, então assume que falta muito.
 *
 * Em três passos ela vê onde está e o que vem depois. E cada passo
 * valida só o que é dele — o erro aparece ao lado do campo errado, e
 * não no fim de tudo.
 */
const PASSOS = [
  { n: 1, rotulo: "Dados", icone: User },
  { n: 2, rotulo: "Entrega", icone: Truck },
  { n: 3, rotulo: "Pagamento", icone: CreditCard },
];

function BarraPassos({ atual }: { atual: number }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <div className="flex items-start">
        {PASSOS.map((p, i) => {
          const concluido = atual > p.n;
          const ativo = atual === p.n;
          const Icone = p.icone;

          return (
            <div key={p.n} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                {/* linha à esquerda */}
                <div
                  className={`h-[2px] flex-1 rounded-full ${i === 0 ? "opacity-0" : ""}`}
                  style={{
                    backgroundColor:
                      atual > p.n - 1 && i > 0
                        ? "var(--store-primary)"
                        : "#e4e4e7",
                  }}
                />
                <div
                  className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor:
                      concluido || ativo ? "var(--store-primary)" : "#e9e9ec",
                    color: concluido || ativo ? "#fff" : "#9ca3af",
                  }}
                  aria-current={ativo ? "step" : undefined}
                >
                  {concluido ? (
                    <Check size={17} strokeWidth={3} />
                  ) : (
                    <Icone size={16} strokeWidth={2.2} />
                  )}
                </div>
                {/* linha à direita */}
                <div
                  className={`h-[2px] flex-1 rounded-full ${i === PASSOS.length - 1 ? "opacity-0" : ""}`}
                  style={{
                    backgroundColor:
                      atual > p.n ? "var(--store-primary)" : "#e4e4e7",
                  }}
                />
              </div>
              <span
                className={`mt-1.5 text-[11.5px] leading-none ${
                  ativo ? "font-bold" : "font-medium text-[#9ca3af]"
                }`}
                style={ativo ? { color: "var(--store-primary)" } : undefined}
              >
                {p.rotulo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]";
const labelCls = "block text-[12px] font-medium text-[#6b7280] mb-1";

export default function StoreCheckout() {
  const { store } = useStore();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<Etapa>("dados");
  /** 1 dados · 2 entrega · 3 pagamento. Só vale enquanto etapa = "dados". */
  const [passo, setPasso] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  /**
   * De que dados o pedido atual nasceu.
   *
   * Agora que dá para voltar do pagamento e confirmar de novo, sem isto
   * cada volta criaria um pedido novo: a loja encheria de pedidos
   * pendentes fantasmas e o lojista não saberia quais são reais.
   */
  const [pedidoCriadoCom, setPedidoCriadoCom] = useState<string | null>(null);
  const [orderNumero, setOrderNumero] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  /**
   * Crédito e débito são escolhas separadas na tela porque é assim que
   * o brasileiro espera pagar. Na cobrança viram a MESMA coisa: a
   * Stripe não distingue os dois na hora de cobrar — quem distingue é
   * o BIN do cartão, lido depois. A escolha fica gravada no pedido; o
   * que saiu de fato fica em payments.cartao_tipo.
   *
   * Começa pelo meio que a loja de fato oferece. Antes começava sempre
   * no Pix, inclusive em loja sem Pix ativado — o cliente entrava num
   * caminho que não existia e só descobria no fim.
   */
  const [metodo, setMetodo] = useState<Metodo>(() => {
    if (store?.modo_compra !== "pagamento") return "whatsapp";
    if (store.aceita_cartao !== false) return "credito";
    if (store.aceita_pix) return "pix";
    return "whatsapp";
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Veio preenchido do aparelho (segunda compra). Serve só para avisar
   * a pessoa — ela precisa SABER que os campos vieram prontos, senão
   * confirma sem ler, e num celular emprestado compraria com o
   * cadastro de outra pessoa.
   */
  const [preenchidoDoAparelho, setPreenchidoDoAparelho] = useState(false);
  /** CEP restaurado que ainda precisa recalcular o frete. */
  const [cepARecalcular, setCepARecalcular] = useState<string | null>(null);

  // Entrega
  const [endereco, setEndereco] = useState<EnderecoEntrega>({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const [buscandoFrete, setBuscandoFrete] = useState(false);
  /** Cru, como veio do Melhor Envio. Vazio nos outros modos. */
  const [opcoesME, setOpcoesME] = useState<OpcaoFrete[]>([]);
  /** Guarda a ESCOLHA, não o objeto: a lista é recalculada a cada
      mudança do carrinho, e um objeto guardado ficaria velho. */
  const [chaveFrete, setChaveFrete] = useState<string | null>(null);
  const [erroFrete, setErroFrete] = useState<string | null>(null);
  /** A tabela das transportadoras não respondeu ou não está ligada. */
  const [freteIndisponivel, setFreteIndisponivel] = useState(false);
  /** Receber em casa ou buscar no balcão. */
  const [entrega, setEntrega] = useState<"entrega" | "retirada">("entrega");

  /**
   * O que ESTA loja oferece.
   *
   * Antes Pix e cartão apareciam sempre, chumbados no JSX: o cliente
   * escolhia Pix, ia até o fim, e a Stripe recusava — porque o Pix
   * exige ativação à parte. Agora a loja diz o que aceita, e o
   * servidor confere de novo antes de cobrar.
   *
   * Calculado aqui em cima, e não lá embaixo, porque o efeito que
   * corrige o meio escolhido é um hook: precisa rodar em TODO render,
   * inclusive antes de a loja carregar. Depois do `return null` ele
   * seria pulado nos primeiros renders e o React quebraria na
   * contagem de hooks.
   */
  const permiteWhatsapp =
    store?.modo_compra === "whatsapp" || store?.modo_compra === "ambos";
  const permitePagamento =
    store?.modo_compra === "pagamento" || store?.modo_compra === "ambos";
  const ofereceCartao = permitePagamento && store?.aceita_cartao !== false;
  const oferecePix = permitePagamento && store?.aceita_pix === true;
  const ofereceAlgumPagamento = ofereceCartao || oferecePix;

  // Se o meio escolhido não for um dos oferecidos, corrige.
  useEffect(() => {
    if (!store) return;
    if (metodo === "pix" && !oferecePix) {
      setMetodo(ofereceCartao ? "credito" : "whatsapp");
    } else if (ehCartao(metodo) && !ofereceCartao) {
      setMetodo(oferecePix ? "pix" : "whatsapp");
    } else if (
      metodo === "whatsapp" &&
      !permiteWhatsapp &&
      ofereceAlgumPagamento
    ) {
      setMetodo(ofereceCartao ? "credito" : "pix");
    }
  }, [
    store,
    metodo,
    oferecePix,
    ofereceCartao,
    permiteWhatsapp,
    ofereceAlgumPagamento,
  ]);

  /**
   * Segunda compra: traz o que ficou guardado no aparelho.
   *
   * Roda uma vez, e só se a pessoa ainda não digitou nada — para nunca
   * apagar o que ela mesma escreveu.
   */
  useEffect(() => {
    if (!store) return;

    const salvo = lerComprador(store.id);
    if (!salvo) return;

    setNome((v) => v || salvo.nome);
    setTelefone((v) => v || salvo.telefone);
    setCpf((v) => v || salvo.cpf);
    setEmail((v) => v || salvo.email);
    setEndereco((e) =>
      e.cep
        ? e
        : {
            cep: salvo.cep,
            logradouro: salvo.logradouro,
            numero: salvo.numero,
            complemento: salvo.complemento,
            bairro: salvo.bairro,
            cidade: salvo.cidade,
            uf: salvo.uf,
          },
    );
    setPreenchidoDoAparelho(true);

    // O frete depende do carrinho de AGORA: o que foi calculado na
    // compra passada não vale mais. Recalcula com o CEP restaurado.
    if (salvo.cep.replace(/\D/g, "").length === 8) {
      setCepARecalcular(salvo.cep);
    }
    // Só na primeira vez que a loja fica disponível.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  useEffect(() => {
    if (!cepARecalcular) return;
    setCepARecalcular(null);
    handleCepChange(cepARecalcular);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepARecalcular]);

  /**
   * As opções de entrega desta loja, para este carrinho.
   *
   * Calculado a partir das regras, e não guardado em estado: o
   * carrinho muda de valor (e o frete grátis liga e desliga junto), e
   * uma lista guardada ficaria mostrando o preço de antes.
   */
  const opcoesEntrega = useMemo<OpcaoEntrega[]>(() => {
    if (!store || entrega === "retirada") return [];

    const gratis =
      store.frete_gratis_acima !== null && total >= store.frete_gratis_acima;

    if (store.frete_modo === "melhor_envio") {
      // Mesmo de graça a transportadora continua sendo escolhida: é o
      // serviço escolhido que compra a etiqueta depois. Quem paga passa
      // a ser a loja.
      return opcoesME.map((op) => ({
        chave: `me-${op.id}`,
        nome: op.nome,
        transportadora: op.transportadora,
        preco: gratis ? 0 : op.preco,
        prazoDias: op.prazo_dias,
        servicoId: op.id,
      }));
    }

    if (gratis) {
      return [
        {
          chave: "gratis",
          nome: "Frete grátis",
          transportadora: "",
          preco: 0,
          prazoDias: store.frete_fixo_prazo_dias,
          servicoId: null,
        },
      ];
    }

    if (store.frete_modo === "fixo" && store.frete_fixo !== null) {
      return [
        {
          chave: "fixo",
          nome: store.frete_fixo_nome?.trim() || "Entrega",
          transportadora: "",
          preco: store.frete_fixo,
          prazoDias: store.frete_fixo_prazo_dias,
          servicoId: null,
        },
      ];
    }

    return [];
  }, [store, entrega, total, opcoesME]);

  const freteSelecionado =
    opcoesEntrega.find((o) => o.chave === chaveFrete) ?? null;

  /* A escolha some quando a lista muda: escolhe a mais barata. */
  useEffect(() => {
    if (opcoesEntrega.length === 0) {
      if (chaveFrete !== null) setChaveFrete(null);
      return;
    }
    if (!opcoesEntrega.some((o) => o.chave === chaveFrete)) {
      setChaveFrete(opcoesEntrega[0].chave);
    }
  }, [opcoesEntrega, chaveFrete]);

  if (!store) return null;

  /**
   * Pedido fecha sem frete, para acertar depois. Acontece quando a
   * loja escolheu esse modo, e também quando ela usa transportadora
   * mas a cotação não veio — melhor deixar comprar e combinar do que
   * perder a venda numa tela travada.
   */
  const freteACombinar =
    entrega === "entrega" &&
    opcoesEntrega.length === 0 &&
    (store.frete_modo === "combinar" || freteIndisponivel);

  const valorFrete = entrega === "retirada" ? 0 : (freteSelecionado?.preco ?? 0);
  const totalComFrete = total + valorFrete;

  async function handleCepChange(valor: string) {
    const formatado = formatarCep(valor);
    setEndereco((e) => ({ ...e, cep: formatado }));
    setOpcoesME([]);
    setErroFrete(null);
    setFreteIndisponivel(false);

    const digitos = formatado.replace(/\D/g, "");
    if (digitos.length !== 8 || !store) return;

    // Só a tabela das transportadoras depende do CEP. Valor fixo,
    // frete grátis e retirada já estão decididos — nem vale a chamada.
    const usaTransportadora = store.frete_modo === "melhor_envio";

    // Bandeira local: `erroFrete` aqui dentro ainda é o valor de antes
    // do setState, então ler o estado daria a resposta errada.
    let houveErro = false;

    setBuscandoFrete(true);
    try {
      const [dadosCep, opcoes] = await Promise.all([
        buscarCep(digitos),
        !usaTransportadora
          ? Promise.resolve([] as OpcaoFrete[])
          : calcularFrete(
          store.id,
          digitos,
          items.map((i) => ({
            product_id: i.productId,
            quantidade: i.quantidade,
          })),
            ).catch((err: Error) => {
              const msg = err.message ?? "";
              // Loja que ainda não ligou a transportadora não é erro do
              // cliente: vira "a combinar" em silêncio. Já falta de
              // medida no produto o cliente precisa ver, senão fica
              // esperando uma lista que nunca vem.
              if (
                msg.includes("não configurou") ||
                msg.includes("CEP de origem")
              ) {
                setFreteIndisponivel(true);
              } else {
                houveErro = true;
                setErroFrete(msg || "Não foi possível calcular o frete.");
              }
              return [] as OpcaoFrete[];
            }),
      ]);

      if (dadosCep) {
        setEndereco((e) => ({
          ...e,
          logradouro: dadosCep.logradouro || e.logradouro,
          bairro: dadosCep.bairro || e.bairro,
          cidade: dadosCep.cidade || e.cidade,
          uf: dadosCep.uf || e.uf,
        }));
      }

      setOpcoesME(opcoes);
      if (usaTransportadora && opcoes.length === 0 && !houveErro) {
        setFreteIndisponivel(true);
      }
    } finally {
      setBuscandoFrete(false);
    }
  }

  /** Retrato do que compõe o pedido. Mudou aqui, é outro pedido. */
  function assinaturaPedido() {
    return JSON.stringify({
      itens: items.map((i) => [
        i.productId,
        i.corSelecionada ?? "",
        i.tamanhoSelecionado ?? "",
        i.quantidade,
        i.preco,
      ]),
      metodo,
      entrega,
      frete: freteSelecionado?.chave ?? null,
      endereco: entrega === "retirada" ? null : endereco,
      cliente: [nome, telefone, cpf, email],
    });
  }

  /** O que falta no passo de dados, ou null se está tudo certo. */
  function erroDados(): string | null {
    if (!nome.trim() || !telefone.trim()) {
      return "Preencha seu nome e telefone.";
    }
    if (cpf.replace(/\D/g, "").length !== 11) {
      return "Informe um CPF válido (11 dígitos).";
    }
    return null;
  }

  /** O que falta no passo de entrega, ou null. */
  function erroEntrega(): string | null {
    // Quem vai buscar no balcão não tem endereço para dar nem frete
    // para escolher.
    if (entrega === "retirada") return null;

    const cepDigits = endereco.cep.replace(/\D/g, "");
    if (
      cepDigits.length !== 8 ||
      !endereco.logradouro.trim() ||
      !endereco.numero.trim() ||
      !endereco.bairro.trim() ||
      !endereco.cidade.trim() ||
      !endereco.uf
    ) {
      return "Preencha o endereço de entrega completo.";
    }
    if (!freteSelecionado && !freteACombinar) {
      return buscandoFrete
        ? "Aguarde o cálculo do frete."
        : "Escolha uma opção de entrega.";
    }
    return null;
  }

  /** Avança um passo, ou mostra o que falta. */
  function avancar() {
    const falta = passo === 1 ? erroDados() : erroEntrega();
    if (falta) {
      setErro(falta);
      return;
    }
    setErro(null);
    setPasso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voltar() {
    setErro(null);
    if (etapa === "pagamento") {
      setEtapa("dados");
      setPasso(3);
      return;
    }
    if (passo > 1) {
      setPasso((p) => p - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(-1);
  }

  /**
   * Passo 1: cria o pedido no banco (sempre, para os 3 métodos).
   * Se for WhatsApp, já finaliza e redireciona. Se for Pix/Cartão,
   * avança para a etapa de pagamento embutido (Stripe Elements),
   * SEM sair da tela da loja.
   */
  async function criarPedidoEContinuar() {
    setErro(null);

    // Confere TUDO de novo, e não só o passo atual: o cliente pode ter
    // voltado e mexido num campo de um passo anterior.
    const falta = erroDados() ?? erroEntrega();
    if (falta) {
      setErro(falta);
      return;
    }
    if (items.length === 0) {
      setErro("Seu carrinho está vazio.");
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, "");

    const cepDigits = endereco.cep.replace(/\D/g, "");

    // Voltou do pagamento sem mudar nada: é o MESMO pedido. Segue para
    // a cobrança em vez de criar outro.
    const assinatura = assinaturaPedido();
    if (orderId && pedidoCriadoCom === assinatura) {
      setEtapa("pagamento");
      return;
    }

    setEnviando(true);
    try {
      const order = await createPublicOrder({
        storeId: store.id,
        itens: items.map((i) => ({
          product_id: i.productId,
          quantidade: i.quantidade,
          cor_selecionada: i.corSelecionada,
          tamanho_selecionado: i.tamanhoSelecionado,
        })),
        metodoPagamento: METODO_NO_BANCO[metodo],
        cliente: { nome, telefone, cpf: cpfDigits, email: email || undefined },
        enderecoEntrega:
          entrega === "retirada" ? null : { ...endereco, cep: cepDigits },
        frete:
          entrega === "retirada"
            ? {
                // Sem serviço de transportadora: é isso que faz a
                // geração de etiqueta recusar com uma mensagem clara,
                // em vez de tentar comprar frete de um pedido que o
                // cliente vem buscar a pé.
                servicoId: null,
                nome: "Retirada na loja",
                transportadora: "",
                preco: 0,
                prazoDias: null,
              }
            : freteSelecionado
              ? {
                  servicoId: freteSelecionado.servicoId,
                  nome: freteSelecionado.nome,
                  transportadora: freteSelecionado.transportadora,
                  preco: freteSelecionado.preco,
                  prazoDias: freteSelecionado.prazoDias,
                }
              : null,
      });

      // Pedido aceito: guarda no aparelho para a próxima compra vir
      // pronta. Só depois de dar certo — dado meio digitado não ajuda
      // ninguém.
      salvarComprador(store.id, {
        nome,
        telefone,
        cpf,
        email,
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        complemento: endereco.complemento ?? "",
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
      });

      if (metodo === "whatsapp") {
        const baseUrl = window.location.origin;
        const linhas = items
          .map((i) => {
            const variacao = descricaoVariacao(
              i.corSelecionada,
              i.tamanhoSelecionado,
            );
            const detalhe = variacao ? ` (${variacao})` : "";
            const linkProduto = `${baseUrl}/loja/${store.slug}/produto/${i.productSlug}`;
            let linha = `• ${i.quantidade}x ${i.nome}${detalhe} — ${formatBRL(i.preco * i.quantidade)}\n  ${linkProduto}`;
            if (i.imagemUrl) {
              linha += `\n  Foto: ${i.imagemUrl}`;
            }
            return linha;
          })
          .join("\n\n");
        const mensagem = encodeURIComponent(
          `Olá! Quero fazer um pedido na ${store.nome} (#${order.numero}):\n\n${linhas}\n\n` +
            `Subtotal: ${formatBRL(total)}\n` +
            (entrega === "retirada"
              ? `Retirada na loja\n`
              : freteSelecionado
                ? `Frete (${[freteSelecionado.transportadora, freteSelecionado.nome].filter(Boolean).join(" ")}${
                    freteSelecionado.prazoDias
                      ? `, ${freteSelecionado.prazoDias} dias úteis`
                      : ""
                  }): ${formatBRL(valorFrete)}\n`
                : `Frete: a combinar\n`) +
            `*Total: ${formatBRL(totalComFrete)}*\n\n` +
            `Nome: ${nome}\n` +
            (entrega === "retirada"
              ? `O cliente vai retirar na loja.`
              : `Entrega: ${endereco.logradouro}, ${endereco.numero}${endereco.complemento ? ` - ${endereco.complemento}` : ""}, ${endereco.bairro}, ${endereco.cidade}/${endereco.uf} - CEP ${endereco.cep}`),
        );
        const numeroLoja = store.whatsapp ? onlyDigits(store.whatsapp) : "";
        clear();
        window.location.href = `https://wa.me/55${numeroLoja}?text=${mensagem}`;
        return;
      }

      // Pix ou Cartão: pedido criado como "pendente", agora mostra
      // o formulário de pagamento embutido — o carrinho só é
      // limpo depois que o pagamento realmente for confirmado.
      setOrderId(order.id);
      setOrderNumero(order.numero);
      setPedidoCriadoCom(assinatura);
      setEtapa("pagamento");
    } catch (err: any) {
      console.error("Erro completo do checkout:", err);
      setErro(err?.message ?? "Erro ao enviar pedido.");
    } finally {
      setEnviando(false);
    }
  }

  /** "Não sou eu": esvazia a tela e esquece o aparelho. */
  function usarOutrosDados() {
    limparComprador(store.id);
    setPreenchidoDoAparelho(false);
    setNome("");
    setTelefone("");
    setCpf("");
    setEmail("");
    setEndereco({
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
    });
    setOpcoesME([]);
    setChaveFrete(null);
    setFreteIndisponivel(false);
    setErro(null);
  }

  function handlePagamentoConfirmado() {
    clear();
    navigate(
      `/loja/${store.slug}/pedido-confirmado?numero=${orderNumero}&metodo=${metodo}`,
    );
  }

  return (
    <div
      className="min-h-dvh pb-32"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--store-primary) 8%, #fafafa 92%) 0px, #fafafa 220px)",
      }}
    >
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() =>
            voltar()
          }
          className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft size={19} className="text-[#374151]" />
        </button>
        <h1 className="text-[15px] font-bold text-[#111827]">
          {etapa === "pagamento"
            ? "Pagamento"
            : passo === 1
              ? "Seus dados"
              : passo === 2
                ? "Entrega"
                : "Pagamento"}
        </h1>
      </div>

      <BarraPassos atual={etapa === "pagamento" ? 4 : passo} />

      {etapa === "dados" && (
        <div className="px-4 pt-3 space-y-4">
          {passo === 1 && (
          <>
          {/* Dados do cliente */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <h2 className="text-[13px] font-bold text-[#111827] mb-3">
              Seus dados
            </h2>

            {preenchidoDoAparelho && (
              <div className="mb-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 flex items-start gap-2.5">
                <UserCheck
                  size={15}
                  className="text-[#15803d] shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-[12px] text-[#15803d] leading-snug font-medium">
                    Preenchemos com os dados da sua última compra nesta loja.
                  </p>
                  <p className="text-[11.5px] text-[#166534] leading-snug mt-0.5">
                    Confira se está tudo certo — dá para alterar qualquer
                    campo.
                  </p>
                  <button
                    type="button"
                    onClick={usarOutrosDados}
                    className="mt-1.5 text-[11.5px] font-semibold text-[#166534] underline"
                  >
                    Não sou eu, limpar
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 11);
                    const formatted = digits
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                    setCpf(formatted);
                  }}
                  placeholder="000.000.000-00"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Usado para você consultar seus pedidos depois, na loja.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
            </div>
          </div>

          </>
          )}

          {passo === 2 && (
          <>
          {/* Entrega */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              {entrega === "retirada" ? (
                <StoreIcon size={15} className="text-[#374151]" />
              ) : (
                <Truck size={15} className="text-[#374151]" />
              )}
              <h2 className="text-[13px] font-bold text-[#111827]">Entrega</h2>
            </div>
            <div className="space-y-3">
              {/* Receber em casa ou buscar no balcão. Só aparece se a
                  loja oferecer retirada — senão é uma escolha de um
                  item só, que não é escolha. */}
              {store.retirada_na_loja && (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["entrega", "Receber em casa", Home],
                      ["retirada", "Retirar na loja", StoreIcon],
                    ] as ["entrega" | "retirada", string, typeof Home][]
                  ).map(([id, rotulo, Icone]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setEntrega(id)}
                      aria-pressed={entrega === id}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                        entrega === id
                          ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                          : "border-[#e4e4e7]"
                      }`}
                    >
                      <Icone
                        size={17}
                        className={
                          entrega === id
                            ? "text-[var(--store-primary)]"
                            : "text-[#9ca3af]"
                        }
                      />
                      <span className="text-[12.5px] font-semibold text-[#111827] text-center leading-snug">
                        {rotulo}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {entrega === "retirada" && (
                <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 py-3">
                  <p className="text-[12.5px] font-semibold text-[#111827]">
                    Você retira o pedido na loja
                  </p>
                  <p className="text-[12px] text-[#6b7280] leading-snug mt-1 whitespace-pre-line">
                    {store.retirada_instrucoes?.trim() ||
                      "A loja entra em contato com o endereço e o horário para você buscar."}
                  </p>
                  <p className="text-[11.5px] text-[#9ca3af] mt-1.5">
                    Sem frete e sem endereço de entrega.
                  </p>
                </div>
              )}

              {entrega === "entrega" && (
                <>
              <div>
                <label className={labelCls}>CEP</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={endereco.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    className={inputCls}
                  />
                  {buscandoFrete && (
                    <Loader2
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#9ca3af]"
                    />
                  )}
                </div>
              </div>

              {endereco.cep.replace(/\D/g, "").length === 8 && (
                <>
                  <div>
                    <label className={labelCls}>Rua / Avenida</label>
                    <input
                      type="text"
                      value={endereco.logradouro}
                      onChange={(e) =>
                        setEndereco((x) => ({
                          ...x,
                          logradouro: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Número</label>
                      <input
                        type="text"
                        value={endereco.numero}
                        onChange={(e) =>
                          setEndereco((x) => ({ ...x, numero: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Complemento</label>
                      <input
                        type="text"
                        value={endereco.complemento ?? ""}
                        onChange={(e) =>
                          setEndereco((x) => ({
                            ...x,
                            complemento: e.target.value,
                          }))
                        }
                        placeholder="Opcional"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Bairro</label>
                    <input
                      type="text"
                      value={endereco.bairro}
                      onChange={(e) =>
                        setEndereco((x) => ({ ...x, bairro: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls}>Cidade</label>
                      <input
                        type="text"
                        value={endereco.cidade}
                        onChange={(e) =>
                          setEndereco((x) => ({ ...x, cidade: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>UF</label>
                      <select
                        value={endereco.uf}
                        onChange={(e) =>
                          setEndereco((x) => ({ ...x, uf: e.target.value }))
                        }
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {estadosBR.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Opções de entrega */}
                  {opcoesEntrega.length > 0 && (
                    <div className="pt-1 space-y-2">
                      {opcoesEntrega.length > 1 && (
                        <p className="text-[12px] font-medium text-[#6b7280]">
                          Escolha o frete
                        </p>
                      )}
                      {opcoesEntrega.map((op) => {
                        const prazo = textoPrazo(op.prazoDias);
                        const escolhida = op.chave === chaveFrete;
                        return (
                          <button
                            key={op.chave}
                            type="button"
                            onClick={() => setChaveFrete(op.chave)}
                            aria-pressed={escolhida}
                            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                              escolhida
                                ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                                : "border-[#e4e4e7]"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#111827]">
                                {[op.transportadora, op.nome]
                                  .filter(Boolean)
                                  .join(" ")}
                              </p>
                              {prazo && (
                                <p className="text-[11px] text-[#9ca3af]">
                                  {prazo}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-[14px] font-bold shrink-0 ${
                                op.preco === 0
                                  ? "text-[#15803d]"
                                  : "text-[#111827]"
                              }`}
                            >
                              {op.preco === 0 ? "Grátis" : formatBRL(op.preco)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {freteACombinar && (
                    <p className="text-[12px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3.5 py-2.5">
                      O valor do frete será combinado com a loja após o pedido.
                    </p>
                  )}

                  {erroFrete && (
                    <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
                      {erroFrete}
                    </p>
                  )}
                </>
              )}
                </>
              )}
            </div>
          </div>

          </>
          )}

          {passo === 3 && (
          <>
          {/* Forma de recebimento do pedido */}
          {(permiteWhatsapp || ofereceAlgumPagamento) && (
            <div className="bg-white rounded-2xl border border-black/5 p-4">
              <h2 className="text-[13px] font-bold text-[#111827] mb-3">
                Como você quer finalizar?
              </h2>
              <div className="space-y-2">
                {permiteWhatsapp && (
                  <button
                    onClick={() => setMetodo("whatsapp")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                      metodo === "whatsapp"
                        ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                        : "border-[#e4e4e7]"
                    }`}
                  >
                    <MessageCircle size={20} className="text-[#16a34a]" />
                    <div className="text-left">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        Pedir pelo WhatsApp
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">
                        Combine pagamento e entrega direto com a loja
                      </p>
                    </div>
                  </button>
                )}
                {oferecePix && (
                  <button
                    onClick={() => setMetodo("pix")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                      metodo === "pix"
                        ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                        : "border-[#e4e4e7]"
                    }`}
                  >
                    <QrCode size={20} className="text-[#374151]" />
                    <div className="text-left">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        Pagar com Pix
                      </p>
                    </div>
                  </button>
                )}
                {ofereceCartao && (
                  <>
                    <button
                      onClick={() => setMetodo("credito")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        metodo === "credito"
                          ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                          : "border-[#e4e4e7]"
                      }`}
                    >
                      <CreditCard size={20} className="text-[#374151]" />
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#111827]">
                          Cartão de crédito
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setMetodo("debito")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        metodo === "debito"
                          ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                          : "border-[#e4e4e7]"
                      }`}
                    >
                      <Landmark size={20} className="text-[#374151]" />
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#111827]">
                          Cartão de débito
                        </p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <h2 className="text-[13.5px] font-bold text-[#111827] mb-3">
              Resumo do pedido
            </h2>
            {/* Com a foto ao lado, a conferência é de relance. Só o
                nome escrito obriga a pessoa a reler item por item para
                ter certeza de que pediu a peça certa. */}
            <div className="space-y-3">
              {items.map((i) => {
                const variacao = descricaoVariacao(
                  i.corSelecionada,
                  i.tamanhoSelecionado,
                );
                return (
                  <div
                    key={`${i.productId}-${i.corSelecionada ?? ""}-${i.tamanhoSelecionado ?? ""}`}
                    className="flex items-start gap-3"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#f4f4f5] overflow-hidden shrink-0">
                      {i.imagemUrl && (
                        <img
                          src={i.imagemUrl}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#111827] leading-snug line-clamp-2">
                        {i.nome}
                      </p>
                      <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                        {[variacao, `Qtd: ${i.quantidade}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <span className="text-[13.5px] font-semibold text-[#111827] shrink-0 tabular-nums">
                      {formatBRL(i.preco * i.quantidade)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#f0f0f1] space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6b7280]">Subtotal</span>
                <span className="text-[#111827]">{formatBRL(total)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#6b7280]">
                  {entrega === "retirada" ? "Retirada" : "Frete"}
                </span>
                <span
                  className={
                    valorFrete === 0 &&
                    (entrega === "retirada" || freteSelecionado)
                      ? "text-[#15803d] font-semibold"
                      : "text-[#111827]"
                  }
                >
                  {entrega === "retirada"
                    ? "Grátis"
                    : freteSelecionado
                      ? valorFrete === 0
                        ? "Grátis"
                        : formatBRL(valorFrete)
                      : freteACombinar
                        ? "A combinar"
                        : "—"}
                </span>
              </div>
              <div
                className="mt-2 -mx-1 px-3 py-2.5 rounded-xl flex items-center justify-between"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--store-primary) 8%, white 92%)",
                }}
              >
                <span className="text-[14px] font-bold text-[#111827]">
                  Total
                </span>
                <span
                  className="text-[18px] font-extrabold tabular-nums"
                  style={{ color: "var(--store-primary)" }}
                >
                  {formatBRL(totalComFrete)}
                </span>
              </div>
            </div>
          </div>

          </>
          )}

          {erro && (
            <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
              {erro}
            </p>
          )}
        </div>
      )}

      {etapa === "pagamento" && orderId && (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0f0f1]">
              <span className="text-[13px] text-[#6b7280]">
                Pedido #{orderNumero}
              </span>
              <span className="text-[16px] font-extrabold text-[#111827]">
                {formatBRL(totalComFrete)}
              </span>
            </div>
            <StripeCardPayment
              storeId={store.id}
              orderId={orderId}
              totalReais={totalComFrete}
              metodo={metodo === "pix" ? "pix" : "card"}
              onSuccess={handlePagamentoConfirmado}
              onError={setErro}
            />
          </div>

          {erro && (
            <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
              {erro}
            </p>
          )}
        </div>
      )}

      {etapa === "dados" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-3 safe-bottom">
          {/* O total acompanha a pessoa desde o primeiro passo: ela não
              deveria precisar chegar ao fim para saber quanto vai pagar. */}
          {passo < 3 && (
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12.5px] text-[#6b7280]">
                {passo === 1 ? "Subtotal" : "Total"}
              </span>
              <span className="text-[16px] font-extrabold text-[#111827] tabular-nums">
                {formatBRL(passo === 1 ? total : totalComFrete)}
              </span>
            </div>
          )}

          <button
            onClick={passo < 3 ? avancar : criarPedidoEContinuar}
            disabled={enviando}
            className="w-full h-[52px] rounded-2xl text-white font-bold text-[15px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {passo === 3 && !enviando && <Lock size={15} strokeWidth={2.4} />}
            {enviando
              ? "Enviando..."
              : passo < 3
                ? "Continuar"
                : metodo === "whatsapp"
                  ? "Enviar pedido no WhatsApp"
                  : "Finalizar compra"}
          </button>

          {passo === 3 && metodo !== "whatsapp" && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] text-[#6b7280]">
              <Lock size={12} strokeWidth={2.4} className="text-[#15803d]" />
              Pagamento protegido
            </p>
          )}
        </div>
      )}
    </div>
  );
}

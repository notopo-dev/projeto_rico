import { useEffect, useRef, useState } from "react";
import "./apresentacao.css";

/**
 * A página principal, para quem ainda não tem conta.
 *
 * ----------------------------------------------------------------
 * A estrutura veio de uma referência que o Rafael escolheu
 * ----------------------------------------------------------------
 * Fundo creme, verde-limão forte, etiqueta em pílula abrindo cada
 * seção, título com palavras coloridas no meio, fileira de cartões
 * verdes em tons diferentes, e uma faixa cheia com um cartão escuro
 * de um lado e os passos do outro.
 *
 * ----------------------------------------------------------------
 * Só promete o que existe
 * ----------------------------------------------------------------
 * Fora daqui: automação de WhatsApp (a tela do painel é maquete e
 * não envia nada), Pix (não existe nas contas Accounts v2) e domínio
 * próprio (os links internos da loja quebram fora da plataforma).
 */

interface ApresentacaoProps {
  /** Teste de um dia: leva ao cadastro. */
  onExperimentar: () => void;
  /** Assinar: também passa pelo cadastro — conta vem antes de cobrança. */
  onAssinar: () => void;
  onEntrar: () => void;
}

/* ============================================================
   A loja dentro do celular
   ============================================================ */

function Peca({ tipo, cor }: { tipo: "camiseta" | "vestido"; cor: string }) {
  return (
    <svg viewBox="0 0 80 96" aria-hidden="true" className="np-peca">
      <rect width="80" height="96" fill="#f2f3ef" />
      {tipo === "camiseta" ? (
        <path
          d="M28 26 L20 32 L14 44 L22 50 L26 42 L26 76 L54 76 L54 42 L58 50 L66 44 L60 32 L52 26 L46 30 Q40 34 34 30 Z"
          fill={cor}
        />
      ) : (
        <path
          d="M30 26 L24 32 L30 44 L24 76 L56 76 L50 44 L56 32 L50 26 L45 30 Q40 33 35 30 Z"
          fill={cor}
        />
      )}
    </svg>
  );
}

const PECAS = [
  { t: "camiseta" as const, c: "#1f2937", n: "Camiseta canelada", p: "79,90" },
  { t: "vestido" as const, c: "#9d5f4e", n: "Vestido midi", p: "189,00" },
  { t: "camiseta" as const, c: "#4d5d45", n: "Regata básica", p: "59,90" },
  { t: "vestido" as const, c: "#2b4a6f", n: "Vestido liso", p: "159,00" },
];

function Celular({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      className={`np-celular${compacto ? " np-celular-peq" : ""}`}
      role="img"
      aria-label="Exemplo de loja aberta no celular"
    >
      <div className="np-tela">
        <div className="np-loja-topo">
          <span className="np-loja-nome">Ateliê Marina</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6c7a70" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 7h12l-1 13H7L6 7Z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
        </div>
        <div className="np-vitrine">
          {PECAS.map((p, i) => (
            <div key={i} className="np-card-peca">
              <Peca tipo={p.t} cor={p.c} />
              <span className="np-card-nome">{p.n}</span>
              <span className="np-card-preco">R$ {p.p}</span>
            </div>
          ))}
        </div>
        <div className="np-loja-rodape">Entrega calculada pelo CEP</div>
      </div>
    </div>
  );
}

/* ============================================================
   A grade de estoque — vai no cartão escuro da faixa
   ============================================================ */

const CORES = [
  { nome: "Preto", hex: "#18181b" },
  { nome: "Off-white", hex: "#efece4" },
  { nome: "Musgo", hex: "#4d5d45" },
];
const TAMANHOS = ["P", "M", "G", "GG"];
const ESTOQUE_INICIAL = [
  [1, 5, 2, 1],
  [0, 1, 4, 2],
  [2, 0, 1, 3],
];

function GradeEscura() {
  const [estoque, setEstoque] = useState(ESTOQUE_INICIAL);
  const [vendendo, setVendendo] = useState(false);
  const [vendida, setVendida] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const jaRodou = useRef(false);

  useEffect(() => {
    const baixar = () => {
      setEstoque((e) => e.map((l, i) => (i === 0 ? [0, ...l.slice(1)] : l)));
      setVendida(true);
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      baixar();
      return;
    }

    // Só vende quando a seção entra na tela: animar escondido
    // gastaria o único momento de movimento da página.
    const alvo = caixa.current;
    if (!alvo) return;

    let t1: number, t2: number;
    const obs = new IntersectionObserver(
      (e) => {
        if (!e[0].isIntersecting || jaRodou.current) return;
        jaRodou.current = true;
        obs.disconnect();
        t1 = window.setTimeout(() => setVendendo(true), 700);
        t2 = window.setTimeout(() => {
          baixar();
          setVendendo(false);
        }, 1400);
      },
      { threshold: 0.4 },
    );
    obs.observe(alvo);
    return () => {
      obs.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div ref={caixa}>
      <div className="np-ge-topo">
        <span className="np-ge-titulo">Camiseta canelada</span>
        <span className="np-ge-codigo">0047</span>
      </div>

      <table className="np-ge-tabela">
        <thead>
          <tr>
            <th scope="col" className="np-ge-cor">
              <span className="np-oculto">Cor</span>
            </th>
            {TAMANHOS.map((t) => (
              <th key={t} scope="col">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CORES.map((cor, i) => (
            <tr key={cor.nome}>
              <th scope="row" className="np-ge-cor">
                <span className="np-bolinha" style={{ background: cor.hex }} aria-hidden="true" />
                {cor.nome}
              </th>
              {TAMANHOS.map((t, j) => {
                const n = estoque[i][j];
                const saindo = vendendo && i === 0 && j === 0;
                return (
                  <td
                    key={t}
                    className={["np-ge-celula", n === 0 ? "np-ge-zero" : "", saindo ? "np-ge-saindo" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {n}
                    <span className="np-oculto">
                      {" "}
                      {cor.nome} tamanho {t}
                      {n === 0 ? ", esgotado" : ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="np-ge-rodape" aria-live="polite">
        {vendida ? "Preto · P acabou agora e saiu da vitrine." : "Cada cor em cada tamanho tem o próprio saldo."}
      </p>
    </div>
  );
}

/* ============================================================ */

export default function Apresentacao({ onExperimentar, onAssinar, onEntrar }: ApresentacaoProps) {
  return (
    <div className="np">
      {/* ---------------- barra ---------------- */}
      <header className="np-barra">
        <a href="/" className="np-marca">
          <span className="np-marca-1">Money</span> NoTopo
        </a>

        <nav className="np-menu">
          <a href="#recursos">Recursos</a>
          <a href="#passos">Como funciona</a>
          <a href="#preco">Preço</a>
        </nav>

        <div className="np-barra-acoes">
          <button type="button" onClick={onEntrar} className="np-link">
            Entrar
          </button>
          <button type="button" onClick={onExperimentar} className="np-btn np-btn-contorno">
            {/* Duas etiquetas, uma escondida por largura de tela. A
                escondida sai com display:none, então o leitor de tela
                lê só uma. Em 320px o rótulo longo estourava a barra. */}
            <span className="np-so-largo">Experimente aqui</span>
            <span className="np-so-estreito">Testar</span>
          </button>
        </div>
      </header>

      <main>
        {/* ---------------- herói ---------------- */}
        <section className="np-heroi">
          <div>
            <h1>
              Tenha sua <span className="np-verde">vitrine virtual</span> pronta{" "}
              <span className="np-verde">hoje</span>
            </h1>
            <p className="np-lead">
              Suas roupas numa loja de verdade, com link para mandar no Instagram. A
              cliente escolhe, paga no cartão e o frete já vem calculado.
            </p>

            <div className="np-cta">
              <button type="button" onClick={onExperimentar} className="np-btn np-btn-lima">
                Experimente 1 dia grátis
              </button>
              <button type="button" onClick={onAssinar} className="np-btn np-btn-escuro">
                Assinar por R$ 78
              </button>
            </div>

            <ul className="np-pilulas">
              {["Estoque por cor e tamanho", "Catálogo", "Cartão", "Frete", "Pedidos", "Relatórios"].map(
                (p) => (
                  <li key={p}>{p}</li>
                ),
              )}
            </ul>
          </div>

          <div className="np-heroi-arte">
            <div className="np-anel" aria-hidden="true" />
            <Celular />
            <div className="np-flutua np-flutua-1" aria-hidden="true">
              <span className="np-flutua-rot">Pedido novo</span>
              <strong>R$ 189,00</strong>
              <span className="np-flutua-pe">Vestido midi · M</span>
            </div>
            <div className="np-flutua np-flutua-2" aria-hidden="true">
              <span className="np-flutua-rot">Frete</span>
              <strong>R$ 24,90</strong>
              <span className="np-flutua-pe">Chega em 4 dias</span>
            </div>
          </div>
        </section>

        {/* ---------------- integrações ---------------- */}
        <section className="np-parceiros">
          <p className="np-parceiros-rot">Funciona junto com</p>
          <ul>
            <li>Melhor Envio</li>
            <li>Correios</li>
            <li>Jadlog</li>
            <li>Visa</li>
            <li>Mastercard</li>
            <li>Elo</li>
          </ul>
        </section>

        {/* ---------------- recursos ---------------- */}
        <section className="np-secao" id="recursos">
          <div className="np-secao-topo">
            <span className="np-pilula-rot">Recursos</span>
            <span className="np-secao-nota">Tudo o que a loja precisa. Nada que ela não use.</span>
          </div>

          <h2 className="np-h2">
            Monte o catálogo, <span className="np-verde">receba no cartão</span> e despache com o
            frete <span className="np-verde-claro">já calculado</span> — num lugar só.
          </h2>

          <div className="np-cartoes">
            <div className="np-cartao np-cartao-foto">
              <Celular compacto />
            </div>

            <div className="np-cartao np-tom-1">
              <h3>Vitrine no ar hoje</h3>
              <p>
                Cadastre as peças, tire a foto e pronto. Você recebe um endereço só seu
                para colocar na bio do Instagram.
              </p>
            </div>

            <div className="np-cartao np-tom-2">
              <h3>Recebimento na sua loja</h3>
              <p>
                A cliente paga com cartão ou Pix sem sair do seu site. O dinheiro cai na
                sua conta, não na nossa.
              </p>
            </div>

            <div className="np-cartao np-tom-3">
              <h3>Frete pelo Melhor Envio</h3>
              <p>
                A cliente digita o CEP e vê valor e prazo antes de fechar. A etiqueta sai
                do painel.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- faixa de passos ---------------- */}
        <section className="np-faixa" id="passos">
          <div className="np-faixa-dentro">
            <div className="np-faixa-cartao">
              <GradeEscura />
            </div>

            <div className="np-faixa-texto">
              <h2>
                Sua loja no ar em <span className="np-sublinha">3 passos</span>
              </h2>

              <ol className="np-passos">
                <li>
                  <span className="np-passo-num">1</span>
                  <div>
                    <h3>Crie a conta</h3>
                    <p>Nome da loja, e-mail e senha. Leva um minuto e não pede cartão.</p>
                  </div>
                </li>
                <li>
                  <span className="np-passo-num">2</span>
                  <div>
                    <h3>Cadastre as peças</h3>
                    <p>
                      Monte a grade de cor e tamanho. O sistema cria as combinações e você
                      digita quanto tem de cada uma.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="np-passo-num">3</span>
                  <div>
                    <h3>Mande o link</h3>
                    <p>
                      Cole o endereço da sua loja na bio do Instagram. A partir daí ela
                      vende sozinha — e nunca o que já acabou.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ---------------- preço ---------------- */}
        <section className="np-secao" id="preco">
          <div className="np-secao-topo">
            <span className="np-pilula-rot">Preço</span>
            <span className="np-secao-nota">Teste um dia. Depois você decide.</span>
          </div>

          <div className="np-plano">
            <div className="np-plano-esq">
              <h2 className="np-h2">
                Um plano só.
                <br />
                <span className="np-verde">Sem porcentagem</span> da sua venda.
              </h2>
              <p>
                Quase toda plataforma cobra uma fatia de cada pedido — quanto mais você
                vende, mais paga. Aqui é fixo. Vendeu dez mil no mês? Continua sendo
                setenta e oito reais.
              </p>
              <p className="np-mini">A taxa da operadora do cartão é cobrada por ela, não por nós.</p>
            </div>

            <div className="np-plano-caixa">
              <span className="np-plano-rot">Plano único</span>
              <div className="np-plano-valor">
                <span className="np-moeda">R$</span>
                <span className="np-numero">78</span>
                <span className="np-mes">/mês</span>
              </div>

              <ul className="np-plano-lista">
                <li>Loja com endereço próprio</li>
                <li>Produtos e grade sem limite</li>
                <li>Cartão e Pix no seu próprio site</li>
                <li>Frete e etiqueta no painel</li>
                <li>Pedidos, clientes e relatórios</li>
                <li>E-mail automático de pedido</li>
              </ul>

              <button type="button" onClick={onAssinar} className="np-btn np-btn-escuro np-btn-cheio">
                Assinar por R$ 78
              </button>
              <button type="button" onClick={onExperimentar} className="np-btn np-btn-vazio np-btn-cheio">
                Experimente 1 dia grátis
              </button>
              <p className="np-plano-pe">Sem fidelidade. Cancele quando quiser.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="np-rodape">
        <div className="np-rodape-dentro">
          <p className="np-marca">
            <span className="np-marca-1">Money</span> NoTopo
          </p>
          <p>Barreiras, Bahia · Rafael Rodrigues Pereira · CNPJ 68.007.923/0001-09</p>
          <p className="np-rodape-links">
            <a href="/termos">Termos de uso</a>
            <a href="/privacidade">Privacidade</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

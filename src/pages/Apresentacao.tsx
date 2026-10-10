import { useEffect, useRef, useState } from "react";
import "./apresentacao.css";

/**
 * A página que o lojista vê antes de ter conta.
 *
 * ----------------------------------------------------------------
 * Para quem nunca viu uma loja virtual
 * ----------------------------------------------------------------
 * A primeira versão abria com a grade de estoque. É o que o sistema
 * tem de melhor, mas exige saber o que é uma grade para entender a
 * imagem — e quem está chegando não sabe. Agora abre com a LOJA
 * dentro de um celular, que diz "isto aqui é a sua vitrine" sem
 * precisar de uma linha de texto. A grade virou a terceira seção,
 * onde já faz sentido.
 *
 * ----------------------------------------------------------------
 * Só o que existe
 * ----------------------------------------------------------------
 * Não entra aqui: automação de WhatsApp (a tela do painel é maquete),
 * Pix (não existe nas contas Accounts v2) e domínio próprio (os links
 * internos quebram fora da plataforma).
 */

interface ApresentacaoProps {
  onExperimentar: () => void;
  onEntrar: () => void;
}

/* ============================================================
   A loja dentro do celular — o herói
   ============================================================ */

/** Peças desenhadas em SVG: sem foto, sem arquivo, sem promessa falsa. */
function Peca({ tipo, cor }: { tipo: "camiseta" | "vestido"; cor: string }) {
  return (
    <svg viewBox="0 0 80 96" aria-hidden="true" className="np-peca">
      <rect width="80" height="96" fill="#f3f5f3" />
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

function Celular() {
  return (
    <div className="np-celular" role="img" aria-label="Exemplo de loja aberta no celular">
      <div className="np-tela">
        <div className="np-loja-topo">
          <span className="np-loja-nome">Ateliê Marina</span>
          <span className="np-loja-sacola" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
          </span>
        </div>

        <div className="np-vitrine">
          {[
            { t: "camiseta" as const, c: "#1f2937", n: "Camiseta canelada", p: "79,90" },
            { t: "vestido" as const, c: "#9d5f4e", n: "Vestido midi", p: "189,00" },
            { t: "camiseta" as const, c: "#4d5d45", n: "Regata básica", p: "59,90" },
            { t: "vestido" as const, c: "#2b4a6f", n: "Vestido liso", p: "159,00" },
          ].map((p, i) => (
            <div key={i} className="np-card">
              <Peca tipo={p.t} cor={p.c} />
              <span className="np-card-nome">{p.n}</span>
              <span className="np-card-preco">R$ {p.p}</span>
            </div>
          ))}
        </div>

        <div className="np-loja-rodape">
          <span>Entrega calculada pelo CEP</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   A grade — terceira seção
   ============================================================ */

const CORES = [
  { nome: "Preto", hex: "#18181b" },
  { nome: "Off-white", hex: "#efece4" },
  { nome: "Verde-musgo", hex: "#4d5d45" },
];
const TAMANHOS = ["P", "M", "G", "GG"];
const ESTOQUE_INICIAL = [
  [1, 5, 2, 1],
  [0, 1, 4, 2],
  [2, 0, 1, 3],
];

function Grade() {
  const [estoque, setEstoque] = useState(ESTOQUE_INICIAL);
  const [vendendo, setVendendo] = useState(false);
  const [vendida, setVendida] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const jaRodou = useRef(false);

  useEffect(() => {
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baixar = () => {
      setEstoque((e) => e.map((l, i) => (i === 0 ? [0, ...l.slice(1)] : l)));
      setVendida(true);
    };

    if (quieto) {
      baixar();
      return;
    }

    // Só vende quando a pessoa chega na seção. Animar fora da tela
    // gastaria o único momento de movimento da página sem ninguém ver.
    const alvo = caixa.current;
    if (!alvo) return;

    let t1: number, t2: number;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting || jaRodou.current) return;
        jaRodou.current = true;
        obs.disconnect();
        t1 = window.setTimeout(() => setVendendo(true), 700);
        t2 = window.setTimeout(() => {
          baixar();
          setVendendo(false);
        }, 1400);
      },
      { threshold: 0.45 },
    );
    obs.observe(alvo);

    return () => {
      obs.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="np-grade" ref={caixa}>
      <div className="np-grade-topo">
        <span className="np-grade-produto">Camiseta canelada</span>
        <span className="np-grade-codigo">0047</span>
      </div>

      <table className="np-tabela">
        <thead>
          <tr>
            <th scope="col" className="np-th-cor">
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
              <th scope="row" className="np-th-cor">
                <span className="np-bolinha" style={{ background: cor.hex }} aria-hidden="true" />
                {cor.nome}
              </th>
              {TAMANHOS.map((t, j) => {
                const n = estoque[i][j];
                const saindo = vendendo && i === 0 && j === 0;
                return (
                  <td
                    key={t}
                    className={["np-celula", n === 0 ? "np-zero" : "", saindo ? "np-saindo" : ""]
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

      <p className="np-grade-rodape" aria-live="polite">
        {vendida ? (
          <>
            <strong>Preto · P</strong> acabou agora e saiu da vitrine.
          </>
        ) : (
          "Cada cor em cada tamanho tem o seu próprio saldo."
        )}
      </p>
    </div>
  );
}

/* ============================================================ */

export default function Apresentacao({ onExperimentar, onEntrar }: ApresentacaoProps) {
  return (
    <div className="np">
      <header className="np-topo">
        <a href="/" className="np-marca">
          <span className="np-marca-1">Money</span> NoTopo
        </a>
        <nav className="np-topo-acoes">
          <button type="button" onClick={onEntrar} className="np-link">
            Entrar
          </button>
          <button type="button" onClick={onExperimentar} className="np-btn np-btn-peq">
            Experimente aqui
          </button>
        </nav>
      </header>

      <main>
        {/* ---------------- Herói ---------------- */}
        <section className="np-heroi">
          <div className="np-heroi-texto">
            <h1>
              Tenha sua vitrine virtual
              <span className="np-preco-inline">
                por <strong>R$ 78</strong> por mês
              </span>
            </h1>

            <p className="np-lead">
              Suas roupas numa loja de verdade, com link para mandar no
              Instagram. A cliente escolhe, paga no cartão e o frete já vem
              calculado.
            </p>

            <div className="np-cta">
              <button type="button" onClick={onExperimentar} className="np-btn np-btn-grande">
                Experimente aqui
              </button>
              <span className="np-cta-nota">Um dia grátis. Sem cartão.</span>
            </div>
          </div>

          <div className="np-heroi-arte">
            <Celular />
          </div>
        </section>

        {/* ---------------- Os três pilares ---------------- */}
        <section className="np-pilares">
          <div className="np-pilar">
            <div className="np-pilar-arte np-arte-vitrine" aria-hidden="true">
              <svg viewBox="0 0 120 84">
                <rect x="6" y="10" width="48" height="62" rx="7" fill="#fff" stroke="#cbd8cf" strokeWidth="1.6" />
                <rect x="66" y="10" width="48" height="62" rx="7" fill="#fff" stroke="#cbd8cf" strokeWidth="1.6" />
                <rect x="14" y="18" width="32" height="28" rx="4" fill="#dcfce7" />
                <rect x="74" y="18" width="32" height="28" rx="4" fill="#dcfce7" />
                <rect x="14" y="52" width="24" height="5" rx="2.5" fill="#cbd8cf" />
                <rect x="74" y="52" width="24" height="5" rx="2.5" fill="#cbd8cf" />
                <rect x="14" y="61" width="15" height="5" rx="2.5" fill="#15803d" />
                <rect x="74" y="61" width="15" height="5" rx="2.5" fill="#15803d" />
              </svg>
            </div>
            <h3>Sua vitrine no ar hoje</h3>
            <p>
              Cadastre as peças, tire a foto e pronto. Você recebe um endereço
              só seu para colocar na bio do Instagram.
            </p>
          </div>

          <div className="np-pilar">
            <div className="np-pilar-arte np-arte-cartao" aria-hidden="true">
              <svg viewBox="0 0 120 84">
                <rect x="16" y="20" width="88" height="54" rx="8" fill="#15803d" />
                <rect x="16" y="32" width="88" height="9" fill="#0f5c2c" />
                <rect x="26" y="52" width="34" height="6" rx="3" fill="#8fd9ab" />
                <rect x="26" y="62" width="20" height="5" rx="2.5" fill="#5bbd82" />
                <circle cx="88" cy="60" r="9" fill="#dcfce7" />
                <path d="M84 60l3 3 6-6" stroke="#15803d" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M46 14h28" stroke="#cbd8cf" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Recebimento na sua loja</h3>
            <p>
              A cliente paga com cartão em até 12 vezes sem sair do seu site. O
              dinheiro cai na sua conta, não na nossa.
            </p>
          </div>

          <div className="np-pilar">
            <div className="np-pilar-arte np-arte-frete" aria-hidden="true">
              <svg viewBox="0 0 120 84">
                <rect x="20" y="30" width="46" height="36" rx="5" fill="#fff" stroke="#cbd8cf" strokeWidth="1.6" />
                <path d="M20 42h46" stroke="#cbd8cf" strokeWidth="1.6" />
                <path d="M39 30v12" stroke="#cbd8cf" strokeWidth="1.6" />
                <path d="M66 42h16l12 12v12H66z" fill="#dcfce7" stroke="#15803d" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="76" cy="68" r="6" fill="#fff" stroke="#15803d" strokeWidth="1.8" />
                <circle cx="36" cy="68" r="6" fill="#fff" stroke="#15803d" strokeWidth="1.8" />
                <path d="M14 36h-8M14 46h-12M14 56h-8" stroke="#8fd9ab" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Frete pelo Melhor Envio</h3>
            <p>
              A cliente digita o CEP e vê o valor e o prazo antes de fechar.
              Correios e transportadoras, com a etiqueta saindo do painel.
            </p>
          </div>
        </section>

        {/* ---------------- A grade ---------------- */}
        <section className="np-secao np-secao-grade">
          <div className="np-grade-texto">
            <h2>E ela nunca vende o que já acabou</h2>
            <p>
              Cada cor em cada tamanho tem o próprio estoque. Vendeu a última P
              preta? Ela some da vitrine na mesma hora — e se duas clientes
              tentarem levar a mesma peça ao mesmo tempo, só uma consegue.
            </p>
          </div>
          <Grade />
        </section>

        {/* ---------------- Preço ---------------- */}
        <section className="np-preco">
          <div className="np-preco-caixa">
            <h2>
              R$ 78 por mês. <span>Só isso.</span>
            </h2>
            <p>
              Sem porcentagem da sua venda. Vendeu dez mil no mês? Continua
              sendo setenta e oito reais.
            </p>
            <button type="button" onClick={onExperimentar} className="np-btn np-btn-grande np-btn-claro">
              Experimente aqui
            </button>
            <span className="np-cta-nota np-nota-clara">
              Um dia para conhecer. Depois você decide.
            </span>
          </div>
        </section>
      </main>

      <footer className="np-rodape">
        <p className="np-marca">
          <span className="np-marca-1">Money</span> NoTopo
        </p>
        <p>Barreiras, Bahia · Rafael Rodrigues Pereira · CNPJ 68.007.923/0001-09</p>
        <p className="np-rodape-links">
          <a href="/termos">Termos de uso</a>
          <a href="/privacidade">Privacidade</a>
        </p>
      </footer>
    </div>
  );
}

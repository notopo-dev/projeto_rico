import { useEffect, useRef, useState } from "react";
import "./apresentacao.css";

/**
 * A página que o lojista vê antes de ter conta.
 *
 * ----------------------------------------------------------------
 * O que ela promete
 * ----------------------------------------------------------------
 * Só o que existe e funciona hoje. Não entra aqui: automação de
 * WhatsApp (a tela do painel é maquete, não envia nada), Pix (a
 * capability não existe nas contas Accounts v2) e domínio próprio
 * (os links internos da loja ainda quebram fora da plataforma).
 *
 * Vender o que não funciona é o jeito mais rápido de perder um
 * cliente de mensalidade no primeiro mês.
 *
 * ----------------------------------------------------------------
 * O herói é a grade
 * ----------------------------------------------------------------
 * Cor nas linhas, tamanho nas colunas. É o objeto que todo mundo que
 * trabalha com roupa reconhece de longe, e é exatamente o que o
 * sistema faz de diferente. Ao carregar, uma venda acontece: a
 * última P preta cai de 1 para 0 e a célula apaga. O produto inteiro
 * num gesto, sem precisar de print de tela.
 */

interface ApresentacaoProps {
  onExperimentar: () => void;
  onEntrar: () => void;
}

const CORES = [
  { nome: "Preto", hex: "#18181b" },
  { nome: "Off-white", hex: "#efece4" },
  { nome: "Verde-musgo", hex: "#4d5d45" },
];
const TAMANHOS = ["P", "M", "G", "GG"];

/** Estoque inicial. A P preta (linha 0, coluna 0) é a que vai sair. */
const ESTOQUE_INICIAL = [
  [1, 5, 2, 1],
  [0, 1, 4, 2],
  [2, 0, 1, 3],
];

function Grade() {
  const [estoque, setEstoque] = useState(ESTOQUE_INICIAL);
  const [vendendo, setVendendo] = useState(false);
  const [vendida, setVendida] = useState(false);
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    // Quem pediu menos movimento já vê o resultado, sem a animação.
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      setEstoque((e) => e.map((l, i) => (i === 0 ? [0, ...l.slice(1)] : l)));
      setVendida(true);
      return;
    }

    const a = setTimeout(() => setVendendo(true), 1400);
    const b = setTimeout(() => {
      setEstoque((e) => e.map((l, i) => (i === 0 ? [0, ...l.slice(1)] : l)));
      setVendendo(false);
      setVendida(true);
    }, 2100);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  return (
    <div className="np-grade">
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
                <span
                  className="np-bolinha"
                  style={{ background: cor.hex }}
                  aria-hidden="true"
                />
                {cor.nome}
              </th>
              {TAMANHOS.map((t, j) => {
                const n = estoque[i][j];
                const estaSaindo = vendendo && i === 0 && j === 0;
                return (
                  <td
                    key={t}
                    className={[
                      "np-celula",
                      n === 0 ? "np-zero" : "",
                      estaSaindo ? "np-saindo" : "",
                    ]
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
          "Cada combinação tem o seu próprio saldo."
        )}
      </p>
    </div>
  );
}

export default function Apresentacao({
  onExperimentar,
  onEntrar,
}: ApresentacaoProps) {
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
            <h1>Pare de vender a peça que já acabou.</h1>
            <p className="np-lead">
              Sua loja online com estoque separado por cor e tamanho. Quando a
              última P preta sai, ela some da vitrine na mesma hora — sem você
              precisar lembrar.
            </p>

            <div className="np-cta">
              <button type="button" onClick={onExperimentar} className="np-btn">
                Experimente aqui
              </button>
              <span className="np-cta-nota">
                Um dia inteiro para testar. Sem cartão.
              </span>
            </div>
          </div>

          <div className="np-heroi-grade">
            <Grade />
          </div>
        </section>

        {/* ---------------- O dia ---------------- */}
        <section className="np-secao np-dia">
          <h2>Um dia na sua loja</h2>

          <ol className="np-linha-tempo">
            <li>
              <span className="np-hora">8h</span>
              <div>
                <h3>Chegou mercadoria</h3>
                <p>
                  Você cadastra a camiseta uma vez e monta a grade: três cores,
                  quatro tamanhos. O sistema cria as doze combinações e você
                  digita quanto tem de cada uma. O código do produto é gerado
                  sozinho.
                </p>
              </div>
            </li>
            <li>
              <span className="np-hora">14h</span>
              <div>
                <h3>Alguém compra</h3>
                <p>
                  A cliente escolhe preto no P. O tamanho que não existe naquela
                  cor aparece riscado, e o que acabou também — ela não consegue
                  pedir o que você não tem. Paga no cartão sem sair da sua loja.
                </p>
              </div>
            </li>
            <li>
              <span className="np-hora">14h01</span>
              <div>
                <h3>O estoque se acerta</h3>
                <p>
                  A peça sai da gaveta certa. Se duas pessoas tentarem comprar a
                  última ao mesmo tempo, só uma leva — o banco de dados tranca a
                  linha. Você recebe o pedido por e-mail com o endereço e o
                  frete já calculados.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* ---------------- O que vem junto ---------------- */}
        <section className="np-secao np-inclui">
          <h2>O que vem junto</h2>
          <div className="np-colunas">
            <dl>
              <dt>Loja com endereço próprio</dt>
              <dd>
                moneynotopo.com.br/loja/seunome, pronta para mandar no
                Instagram.
              </dd>

              <dt>Grade de cor e tamanho</dt>
              <dd>
                Estoque por combinação, não um número só para o produto todo.
                Cor que não sai em certo tamanho simplesmente não existe.
              </dd>

              <dt>Pagamento no cartão</dt>
              <dd>
                A cliente paga dentro da sua loja, sem ir para outro site. Em
                até 12 vezes.
              </dd>

              <dt>Frete calculado</dt>
              <dd>
                O cliente digita o CEP e vê o valor e o prazo antes de fechar.
                Você imprime a etiqueta no painel.
              </dd>
            </dl>

            <dl>
              <dt>Pedidos e clientes</dt>
              <dd>
                Quem comprou, o que levou, quanto gastou. Histórico por pessoa,
                sem planilha.
              </dd>

              <dt>Retirada no balcão</dt>
              <dd>
                Para quem busca na loja: pagamento em dinheiro ou maquininha,
                registrado no mesmo lugar.
              </dd>

              <dt>E-mail automático</dt>
              <dd>
                A cliente recebe a confirmação do pedido e o aviso de envio com
                o código de rastreio. Você recebe o aviso de venda nova.
              </dd>

              <dt>Relatórios</dt>
              <dd>
                Quanto entrou, o que mais sai, o que está parado na prateleira.
              </dd>
            </dl>
          </div>
        </section>

        {/* ---------------- Preço ---------------- */}
        <section className="np-secao np-preco">
          <div className="np-preco-caixa">
            <div className="np-preco-valor">
              <span className="np-moeda">R$</span>
              <span className="np-numero">78</span>
              <span className="np-por">por mês</span>
            </div>

            <div className="np-preco-texto">
              <h2>Um plano só. Sem porcentagem da sua venda.</h2>
              <p>
                Quase toda plataforma cobra uma fatia de cada pedido — quanto
                mais você vende, mais paga. Aqui é um valor fixo. Vendeu dez mil
                no mês? Continua sendo setenta e oito reais.
              </p>
              <p className="np-preco-mini">
                A taxa da operadora do cartão é cobrada por ela, não por nós.
              </p>

              <div className="np-cta">
                <button type="button" onClick={onExperimentar} className="np-btn">
                  Experimente aqui
                </button>
                <span className="np-cta-nota">
                  Um dia para conhecer. Depois você decide.
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="np-rodape">
        <p className="np-marca">
          <span className="np-marca-1">Money</span> NoTopo
        </p>
        <p>
          Barreiras, Bahia · Rafael Rodrigues Pereira · CNPJ
          68.007.923/0001-09
        </p>
        <p className="np-rodape-links">
          <a href="/termos">Termos de uso</a>
          <a href="/privacidade">Privacidade</a>
        </p>
      </footer>
    </div>
  );
}

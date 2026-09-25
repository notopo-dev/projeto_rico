// src/pages/Termos.tsx
//
// Página pública de Termos de Uso.
// A Stripe visita esta URL ao revisar o perfil da plataforma (Connect).
//
// A rota fica em RootRouter.tsx (já adicionada):
//   <Route path="/termos" element={<Termos />} />
//
// ⚠️ Troque os campos marcados com [[ ]] antes de publicar.
// ⚠️ Não sou advogado — este texto é um ponto de partida sólido para a
//    revisão da Stripe, mas peça a um advogado para revisar antes de
//    operar com volume.

import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const ATUALIZADO_EM = "24 de setembro de 2026";

export default function Termos() {
  return (
    <div className="min-h-dvh bg-[#fafafa]">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
            aria-label="Voltar"
          >
            <ChevronLeft size={19} className="text-[#374151]" />
          </button>
          <h1 className="text-[15px] font-bold text-[#111827]">Termos de Uso</h1>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-4 py-6 pb-20">
        <p className="text-[12px] text-[#9ca3af] mb-6">
          Última atualização: {ATUALIZADO_EM}
        </p>

        <Secao titulo="1. Quem somos">
          <P>
            Estes Termos regem o uso da plataforma <strong>Money NoTopo</strong>,
            operada por <strong>[[RAZÃO SOCIAL]]</strong>, inscrita no CNPJ sob o
            nº <strong>[[CNPJ]]</strong>, com sede em Barreiras, Bahia, Brasil
            (“Plataforma”, “nós”).
          </P>
          <P>
            Contato: <A href="mailto:contato@moneynotopo.com.br">
              contato@moneynotopo.com.br
            </A>
          </P>
        </Secao>

        <Secao titulo="2. O que a Plataforma faz">
          <P>
            A Money NoTopo é um serviço de software por assinatura (SaaS) que
            permite a comerciantes (“Lojistas”) criar e administrar sua própria
            loja virtual: cadastro de produtos, controle de estoque, recebimento
            de pedidos, cálculo de frete e recebimento de pagamentos online.
          </P>
          <P>
            <strong>A Plataforma não vende os produtos anunciados.</strong> Cada
            Lojista é o vendedor, responsável pelos produtos, preços, descrições,
            prazos, entrega, trocas, devoluções e atendimento aos seus clientes.
            Atuamos exclusivamente como fornecedor da tecnologia.
          </P>
        </Secao>

        <Secao titulo="3. Cadastro e conta">
          <P>
            Para usar a Plataforma, o Lojista deve ser maior de 18 anos, fornecer
            informações verdadeiras e manter seus dados atualizados. A senha é
            pessoal e intransferível; o Lojista é responsável por todas as
            atividades realizadas em sua conta.
          </P>
          <P>
            Podemos suspender ou encerrar contas que violem estes Termos, a
            legislação brasileira ou as políticas dos nossos fornecedores de
            pagamento.
          </P>
        </Secao>

        <Secao titulo="4. Assinatura e pagamento">
          <P>
            O acesso à Plataforma é cobrado por <strong>mensalidade</strong>, no
            valor vigente informado no momento da contratação. Não cobramos
            percentual sobre as vendas do Lojista.
          </P>
          <P>
            A mensalidade é cobrada automaticamente a cada período, debitada do
            saldo do Lojista na Stripe ou do meio de pagamento por ele cadastrado.
            Em caso de falha de cobrança, tentaremos novamente e poderemos
            suspender o acesso após inadimplência persistente.
          </P>
          <P>
            O Lojista pode cancelar a qualquer momento pelo painel. O cancelamento
            encerra as cobranças futuras; não há devolução proporcional do período
            já pago, salvo exigência legal.
          </P>
        </Secao>

        <Secao titulo="5. Pagamentos e o papel da Stripe">
          <P>
            Os pagamentos dos clientes finais são processados pela{" "}
            <strong>Stripe</strong>, por meio do Stripe Connect. Cada Lojista
            possui sua própria conta conectada na Stripe e é o{" "}
            <em>merchant of record</em> das vendas que realiza — os valores são
            recebidos diretamente por ele.
          </P>
          <P>
            Ao ativar o recebimento online, o Lojista também aceita os{" "}
            <A href="https://stripe.com/br/legal/connect-account">
              termos de conta conectada da Stripe
            </A>
            . A Stripe pode exigir documentos e verificação de identidade, e pode
            reter ou recusar repasses conforme suas próprias políticas e a
            regulação aplicável.
          </P>
          <P>
            Estornos, chargebacks e disputas são de responsabilidade do Lojista,
            que suporta os valores correspondentes e eventuais tarifas.
          </P>
        </Secao>

        <Secao titulo="6. Uso proibido">
          <P>É vedado usar a Plataforma para:</P>
          <Lista
            itens={[
              "comercializar produtos ou serviços ilícitos, falsificados ou de origem irregular;",
              "vender itens proibidos pelas políticas da Stripe (armas, drogas, conteúdo adulto, serviços financeiros não autorizados, entre outros);",
              "praticar fraude, lavagem de dinheiro ou simular transações;",
              "violar direitos de terceiros, incluindo marca e direito autoral;",
              "tentar burlar limites técnicos, acessar dados de outras lojas ou comprometer a segurança do sistema.",
            ]}
          />
          <P>
            A constatação de qualquer dessas práticas permite o encerramento
            imediato da conta, sem devolução de valores.
          </P>
        </Secao>

        <Secao titulo="7. Conteúdo do Lojista">
          <P>
            Textos, fotos e marcas publicados pelo Lojista continuam sendo dele.
            Ao publicá-los, o Lojista nos concede licença limitada para
            armazená-los e exibi-los no funcionamento da loja, e declara possuir
            os direitos necessários.
          </P>
        </Secao>

        <Secao titulo="8. Disponibilidade e limitação de responsabilidade">
          <P>
            Trabalhamos para manter a Plataforma disponível, mas não garantimos
            funcionamento ininterrupto. Podem ocorrer manutenções, falhas de
            terceiros (hospedagem, Stripe, transportadoras) e indisponibilidades.
          </P>
          <P>
            Nossa responsabilidade, quando existir, limita-se ao valor das
            mensalidades pagas pelo Lojista nos 12 meses anteriores ao evento. Não
            respondemos por lucros cessantes nem por danos decorrentes da relação
            entre o Lojista e seus clientes.
          </P>
        </Secao>

        <Secao titulo="9. Proteção de dados">
          <P>
            O tratamento de dados pessoais segue a Lei nº 13.709/2018 (LGPD) e
            está descrito na nossa{" "}
            <Link
              to="/privacidade"
              className="underline decoration-[#d4d4d8] underline-offset-2"
            >
              Política de Privacidade
            </Link>
            .
          </P>
          <P>
            Em relação aos dados dos clientes finais da loja, o Lojista atua como
            controlador e nós como operadores, nos limites necessários à prestação
            do serviço.
          </P>
        </Secao>

        <Secao titulo="10. Alterações">
          <P>
            Podemos alterar estes Termos. Mudanças relevantes serão comunicadas
            por e-mail ou no painel com antecedência mínima de 15 dias. O uso
            continuado após a vigência significa concordância.
          </P>
        </Secao>

        <Secao titulo="11. Foro">
          <P>
            Aplica-se a legislação brasileira. Fica eleito o foro da comarca de
            Barreiras, Bahia, para dirimir controvérsias, salvo quando a lei
            garantir ao consumidor foro diverso.
          </P>
        </Secao>

        <footer className="mt-10 pt-6 border-t border-black/5 text-[12px] text-[#9ca3af]">
          <p>
            [[RAZÃO SOCIAL]] — CNPJ [[CNPJ]] — Barreiras/BA
            <br />
            contato@moneynotopo.com.br
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ------------------------- blocos de apoio ------------------------- */

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <h2 className="text-[15px] font-bold text-[#111827] mb-2">{titulo}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13.5px] leading-relaxed text-[#374151]">{children}</p>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {itens.map((item, i) => (
        <li
          key={i}
          className="text-[13.5px] leading-relaxed text-[#374151] flex gap-2"
        >
          <span className="text-[#9ca3af] shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-[#d4d4d8] underline-offset-2"
    >
      {children}
    </a>
  );
}

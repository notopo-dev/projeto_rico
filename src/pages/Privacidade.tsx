// src/pages/Privacidade.tsx
//
// Página pública de Política de Privacidade (LGPD).
// A Stripe visita esta URL ao revisar o perfil da plataforma (Connect).
//
// A rota fica em RootRouter.tsx (já adicionada):
//   <Route path="/privacidade" element={<Privacidade />} />
//
// ⚠️ Troque os campos marcados com [[ ]] antes de publicar.

import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const ATUALIZADO_EM = "24 de setembro de 2026";

export default function Privacidade() {
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
          <h1 className="text-[15px] font-bold text-[#111827]">
            Política de Privacidade
          </h1>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-4 py-6 pb-20">
        <p className="text-[12px] text-[#9ca3af] mb-6">
          Última atualização: {ATUALIZADO_EM}
        </p>

        <Secao titulo="1. Quem trata seus dados">
          <P>
            <strong>[[RAZÃO SOCIAL]]</strong>, CNPJ <strong>[[CNPJ]]</strong>,
            sediada em Barreiras, Bahia, operadora da plataforma{" "}
            <strong>Money NoTopo</strong>.
          </P>
          <P>
            Encarregado de dados (DPO):{" "}
            <A href="mailto:privacidade@moneynotopo.com.br">
              privacidade@moneynotopo.com.br
            </A>
          </P>
        </Secao>

        <Secao titulo="2. Dois papéis diferentes">
          <P>
            <strong>Quando você é Lojista</strong> (contrata a plataforma), somos
            controladores dos seus dados de cadastro e cobrança.
          </P>
          <P>
            <strong>Quando você é cliente de uma loja</strong> hospedada aqui,
            quem controla seus dados é o Lojista. Nós apenas armazenamos e
            processamos em nome dele, como operadores. Pedidos de exclusão ou
            correção nesse caso devem ser encaminhados ao Lojista, e nós damos
            suporte técnico para atendê-los.
          </P>
        </Secao>

        <Secao titulo="3. Quais dados coletamos">
          <SubTitulo>Do Lojista</SubTitulo>
          <Lista
            itens={[
              "Nome, e-mail e senha (armazenada apenas como hash, nunca em texto legível)",
              "Dados da loja: nome, descrição, logotipo, endereço de origem para frete",
              "CPF ou CNPJ, endereço e dados bancários, quando ativa o recebimento online",
              "Registros de acesso (data, hora e endereço IP), por exigência do Marco Civil da Internet",
            ]}
          />
          <SubTitulo>Do cliente final da loja</SubTitulo>
          <Lista
            itens={[
              "Nome, telefone, e-mail e CPF",
              "Endereço de entrega e CEP",
              "Itens do pedido, valores e status",
            ]}
          />
          <P>
            <strong>Não armazenamos dados de cartão.</strong> O número do cartão
            é digitado dentro de um componente da própria Stripe e vai
            criptografado direto para ela. Nossos servidores nunca veem esse dado.
          </P>
        </Secao>

        <Secao titulo="4. Para que usamos">
          <Lista
            itens={[
              "Criar e manter a conta e a loja",
              "Processar pedidos, pagamentos e cálculo de frete",
              "Emitir etiquetas e permitir o rastreamento das entregas",
              "Cobrar a mensalidade da assinatura",
              "Prevenir fraude e uso indevido",
              "Cumprir obrigações legais e fiscais",
            ]}
          />
          <P>
            Bases legais: execução de contrato (art. 7º, V da LGPD), cumprimento
            de obrigação legal (art. 7º, II) e legítimo interesse para segurança e
            prevenção a fraude (art. 7º, IX).
          </P>
        </Secao>

        <Secao titulo="5. Com quem compartilhamos">
          <Tabela
            linhas={[
              ["Stripe", "Processamento de pagamentos e verificação de identidade"],
              ["Supabase", "Banco de dados, autenticação e armazenamento de arquivos"],
              ["Vercel", "Hospedagem da aplicação"],
              ["Melhor Envio", "Cálculo de frete, emissão de etiqueta e rastreamento"],
              ["Transportadoras", "Entrega dos pedidos (Correios, Jadlog e demais)"],
            ]}
          />
          <P>
            Alguns desses fornecedores processam dados fora do Brasil. A
            transferência internacional ocorre com base em cláusulas contratuais
            e salvaguardas adequadas, conforme o art. 33 da LGPD.
          </P>
          <P>
            <strong>Não vendemos dados pessoais</strong> e não os cedemos para
            publicidade de terceiros.
          </P>
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          <Lista
            itens={[
              "Dados da conta: enquanto a conta existir",
              "Pedidos e pagamentos: 5 anos após a transação, por exigência fiscal e do Código de Defesa do Consumidor",
              "Registros de acesso: 6 meses, conforme o Marco Civil da Internet",
            ]}
          />
          <P>
            Encerrada a conta, os dados que não precisam ser retidos por lei são
            eliminados ou anonimizados.
          </P>
        </Secao>

        <Secao titulo="7. Seus direitos">
          <P>
            A LGPD garante a você confirmar a existência de tratamento, acessar
            seus dados, corrigir dados incompletos ou desatualizados, solicitar
            anonimização ou eliminação, pedir a portabilidade, revogar o
            consentimento e se opor a tratamentos feitos com base em legítimo
            interesse.
          </P>
          <P>
            Para exercer qualquer deles, escreva para{" "}
            <A href="mailto:privacidade@moneynotopo.com.br">
              privacidade@moneynotopo.com.br
            </A>
            . Respondemos em até 15 dias.
          </P>
        </Secao>

        <Secao titulo="8. Segurança">
          <Lista
            itens={[
              "Tráfego criptografado em HTTPS de ponta a ponta",
              "Senhas armazenadas com hash, nunca em texto legível",
              "Isolamento por loja no banco de dados (row level security), de modo que uma loja não acessa dados de outra",
              "Dados de cartão nunca trafegam pelos nossos servidores",
              "Controle de acesso verificado no servidor, e não apenas na tela",
            ]}
          />
          <P>
            Em caso de incidente de segurança com risco relevante, comunicaremos
            os titulares afetados e a ANPD nos prazos legais.
          </P>
        </Secao>

        <Secao titulo="9. Cookies">
          <P>
            Usamos apenas cookies e armazenamento local necessários ao
            funcionamento: manter sua sessão iniciada e preservar o carrinho de
            compras. Não usamos cookies de publicidade comportamental.
          </P>
        </Secao>

        <Secao titulo="10. Crianças e adolescentes">
          <P>
            A plataforma não se destina a menores de 18 anos e não coletamos
            intencionalmente dados dessa faixa etária. Identificado esse caso, os
            dados são eliminados.
          </P>
        </Secao>

        <Secao titulo="11. Alterações">
          <P>
            Esta Política pode ser atualizada. A data no topo indica a versão
            vigente, e mudanças relevantes são comunicadas por e-mail ou no painel.
          </P>
        </Secao>

        <footer className="mt-10 pt-6 border-t border-black/5 text-[12px] text-[#9ca3af]">
          <p>
            [[RAZÃO SOCIAL]] — CNPJ [[CNPJ]] — Barreiras/BA
            <br />
            privacidade@moneynotopo.com.br
          </p>
          <Link
            to="/termos"
            className="inline-block mt-2 underline decoration-[#d4d4d8] underline-offset-2"
          >
            Termos de Uso
          </Link>
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

function SubTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold text-[#111827] pt-1">{children}</h3>
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

function Tabela({ linhas }: { linhas: [string, string][] }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
      {linhas.map(([quem, paraQue], i) => (
        <div
          key={quem}
          className={`px-3.5 py-2.5 ${i > 0 ? "border-t border-black/5" : ""}`}
        >
          <p className="text-[13px] font-semibold text-[#111827]">{quem}</p>
          <p className="text-[12.5px] text-[#6b7280] mt-0.5 leading-snug">
            {paraQue}
          </p>
        </div>
      ))}
    </div>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="underline decoration-[#d4d4d8] underline-offset-2"
    >
      {children}
    </a>
  );
}

import { useState } from "react";
import { Wallet, ArrowDownToLine, Receipt, Scale } from "lucide-react";
import {
  PainelDocumentos,
  PainelPagamentos,
  PainelRepasses,
  PainelSaldos,
} from "../components/StripeConnectPaineis";
import { StripeConnectProvider } from "../components/StripeConnectContexto";

/**
 * Financeiro da loja: pagamentos recebidos, repasses para o banco,
 * saldo e documentos fiscais.
 *
 * Os quatro blocos são componentes embutidos da conta de recebimento —
 * os dados vêm direto do provedor de pagamento, sem passar pelo nosso
 * banco, então estão sempre atualizados.
 *
 * ⚠️ Esta página está cadastrada em site-links como a página de
 * "Pagamentos", "Repasses" e "Saldos". Se mudar a rota, atualize lá,
 * senão as sessões param de ser criadas em produção.
 */

type Aba = "pagamentos" | "repasses" | "saldos" | "documentos";

const ABAS: { id: Aba; nome: string; icone: typeof Wallet; texto: string }[] = [
  {
    id: "pagamentos",
    nome: "Pagamentos",
    icone: Receipt,
    texto: "Vendas recebidas, reembolsos e contestações.",
  },
  {
    id: "repasses",
    nome: "Repasses",
    icone: ArrowDownToLine,
    texto: "Transferências para a sua conta bancária.",
  },
  {
    id: "saldos",
    nome: "Saldo",
    icone: Wallet,
    texto: "Disponível, a caminho e cronograma de repasse.",
  },
  {
    id: "documentos",
    nome: "Documentos",
    icone: Scale,
    texto: "Faturas e informes fiscais para download.",
  },
];

export default function Pagamentos() {
  const [aba, setAba] = useState<Aba>("pagamentos");
  const atual = ABAS.find((a) => a.id === aba)!;

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto">
      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-[#e4e4e7] mb-4">
        {ABAS.map(({ id, nome, icone: Icone }) => {
          const ativa = id === aba;
          return (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`shrink-0 px-3.5 py-2.5 text-[13px] font-medium inline-flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
                ativa
                  ? "border-[#0f1117] text-[#0f1117]"
                  : "border-transparent text-[#6b7280] hover:text-[#374151]"
              }`}
            >
              <Icone size={15} />
              {nome}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7]">
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            {atual.nome}
          </h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">{atual.texto}</p>
        </div>

        <div className="px-4 py-4">
          {/* Uma instância só para as quatro abas: trocar de aba não
              refaz a sessão nem abre outra conexão com a Stripe. */}
          <StripeConnectProvider>
            {aba === "pagamentos" && <PainelPagamentos />}
            {aba === "repasses" && <PainelRepasses />}
            {aba === "saldos" && <PainelSaldos />}
            {aba === "documentos" && <PainelDocumentos />}
          </StripeConnectProvider>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] text-[#9ca3af] leading-snug">
        Os valores aqui vêm direto do provedor de pagamento e refletem o
        estado atual da sua conta. Se a conta ainda estiver em verificação,
        os painéis aparecem vazios até a liberação.
      </p>
    </div>
  );
}

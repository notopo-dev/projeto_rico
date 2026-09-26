import StripeStatusPanel from "../components/StripeStatusPanel";
import { StripeConnectProvider } from "../components/StripeConnectContexto";

/**
 * Tela dedicada à conta de recebimento.
 *
 * Antes isto morava dentro de Configurações › Integrações, dividindo
 * espaço com token do Melhor Envio, chave Pix e Mercado Pago. Não
 * funcionava: o formulário de verificação da Stripe é alto, abre
 * janelas e muda de estado sozinho conforme a análise avança — ficava
 * espremido e atrapalhava o resto da aba.
 *
 * Aqui ele tem a página inteira, que é o que o fluxo pede.
 */
export default function Recebimentos() {
  return (
    <div className="p-4 sm:p-6 max-w-[860px] mx-auto space-y-4">
      <div className="px-1">
        <h1 className="text-[18px] font-bold text-[#0f1117]">
          Conta de recebimento
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1 leading-snug">
          É por aqui que o dinheiro das suas vendas chega até você. Para
          liberar, confirmamos sua identidade e a conta bancária de
          destino — uma vez só.
        </p>
      </div>

      {/* Uma instância do Connect para a página inteira. O painel de
          status, o banner de avisos e o formulário de verificação
          compartilham ela — criar uma por componente travava a tela. */}
      <StripeConnectProvider>
        <StripeStatusPanel />
      </StripeConnectProvider>

      <div className="cartao-app p-4">
        <h2 className="text-[13px] font-semibold text-[#0f1117]">
          Como funciona o dinheiro da sua loja
        </h2>
        <ul className="mt-2.5 space-y-2">
          {[
            "O cliente paga no checkout e o valor vai direto para a sua conta, sem passar por nós.",
            "O saldo fica disponível e é transferido para o seu banco conforme o cronograma de repasse.",
            "Você acompanha vendas, saldo e repasses na tela Pagamentos.",
            "A plataforma cobra mensalidade — nunca percentual sobre as suas vendas.",
          ].map((texto) => (
            <li
              key={texto}
              className="text-[12.5px] text-[#6b7280] leading-snug flex gap-2"
            >
              <span className="text-[#16a34a] mt-0.5 shrink-0">•</span>
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

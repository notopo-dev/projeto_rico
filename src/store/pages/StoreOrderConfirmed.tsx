import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  CreditCard,
  QrCode,
} from "lucide-react";
import { useStore } from "../context/StoreContext";

/**
 * Tela final do checkout.
 *
 * Esta tela foi escrita quando a loja ainda não cobrava online: ela
 * dizia "assim que configurarmos o pagamento via cartão, você poderá
 * concluir por aqui" para TODO pedido com cartão — inclusive depois
 * de a cobrança ter sido aprovada. O cliente pagava e era informado
 * de que o pagamento não existia.
 *
 * Agora o `status` vem na URL, vindo do PaymentIntent, e a tela diz
 * o que de fato aconteceu.
 */

export default function StoreOrderConfirmed() {
  const { store } = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const numero = params.get("numero");
  const metodo = params.get("metodo");
  const status = params.get("status");

  if (!store) return null;

  const pago = status === "succeeded";
  const processando = status === "processing";
  const foiOnline = metodo === "cartao" || metodo === "pix";

  const visual = pago
    ? {
        icone: <CheckCircle2 size={32} className="text-white" strokeWidth={2} />,
        titulo: `Pagamento aprovado!`,
        texto:
          "Recebemos o seu pagamento. A loja já foi avisada e vai preparar o seu pedido.",
      }
    : processando
      ? {
          icone: <Clock size={30} className="text-white" strokeWidth={2} />,
          titulo: `Pedido #${numero} recebido!`,
          texto:
            "O seu pagamento está sendo processado. Assim que for confirmado, a loja começa a preparar o pedido — costuma levar poucos minutos.",
        }
      : foiOnline
        ? {
            icone: <Clock size={30} className="text-white" strokeWidth={2} />,
            titulo: `Pedido #${numero} recebido!`,
            texto:
              "Estamos confirmando o seu pagamento. Se algo der errado, a loja entra em contato pelo telefone que você informou.",
          }
        : {
            icone: (
              <MessageCircle size={30} className="text-white" strokeWidth={2} />
            ),
            titulo: `Pedido #${numero} recebido!`,
            texto:
              "A loja já recebeu os detalhes do seu pedido e vai falar com você para combinar pagamento e entrega.",
          };

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-6 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        {visual.icone}
      </div>

      <h1 className="text-[19px] font-bold text-[#111827]">{visual.titulo}</h1>

      {pago && numero && (
        <p className="mt-1 text-[13px] font-semibold text-[#6b7280]">
          Pedido #{numero}
        </p>
      )}

      <p className="mt-1.5 text-[13px] text-[#6b7280] max-w-[280px] leading-snug">
        {visual.texto}
      </p>

      {foiOnline && (
        <div className="mt-5 w-full max-w-[280px] rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-4 flex items-center gap-3">
          {metodo === "pix" ? (
            <QrCode size={22} className="text-[#374151] shrink-0" />
          ) : (
            <CreditCard size={22} className="text-[#374151] shrink-0" />
          )}
          <p className="text-[11px] text-[#6b7280] text-left leading-snug">
            {pago
              ? "Guarde o número do pedido para acompanhar a entrega."
              : "Guarde o número do pedido. Você pode consultá-lo em “Meus pedidos”."}
          </p>
        </div>
      )}

      <button
        onClick={() => navigate(`/loja/${store.slug}`)}
        className="mt-6 h-12 px-6 rounded-full text-white text-[13px] font-semibold"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        Voltar para a loja
      </button>
    </div>
  );
}

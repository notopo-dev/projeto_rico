import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { criarPaymentIntent } from "../lib/stripeApi";

// A chave PUBLICÁVEL é segura no frontend por design — a
// secreta nunca sai da Edge Function.
// https://docs.stripe.com/js/initializing
//
// ⚠️ Em COBRANÇA DIRETA o Stripe.js precisa saber de qual conta
// conectada é o pagamento. Por isso o loadStripe não roda mais no
// topo do arquivo: ele só é criado depois que a Edge Function
// responde com o stripeAccount.
// https://docs.stripe.com/connect/direct-charges#create-payment-intent

interface StripeCardPaymentProps {
  storeId: string;
  orderId: string;
  totalReais: number;
  metodo: "pix" | "card";
  /**
   * Chamado quando a confirmação volta sem erro.
   *
   * Recebe o status real do pagamento — "succeeded" ou "processing".
   * Antes não recebia nada, e a tela seguinte tinha que adivinhar:
   * dizia "assim que configurarmos o pagamento" mesmo depois de a
   * cobrança ter sido aprovada.
   */
  onSuccess: (status: string | null) => void;
  onError: (mensagem: string) => void;
}

function FormularioCartao({
  onSuccess,
  onError,
}: {
  onSuccess: (status: string | null) => void;
  onError: (mensagem: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processando, setProcessando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessando(true);

    // confirmPayment SEM redirect: o pagamento é confirmado direto
    // aqui na tela, sem sair da loja.
    // https://docs.stripe.com/js/payment_intents/confirm_payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Erro ao processar o pagamento.");
      setProcessando(false);
      return;
    }

    // "succeeded" = aprovado agora. "processing" = a Stripe ainda
    // está liquidando (acontece em alguns cartões e no Pix). Quem
    // decide se o pedido virou pago é o webhook, não esta tela —
    // mas o cliente merece saber em qual dos dois está.
    onSuccess(paymentIntent?.status ?? null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || processando}
        className="w-full h-13 min-h-[52px] rounded-2xl text-white font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        {processando && <Loader2 size={16} className="animate-spin" />}
        {processando ? "Processando..." : "Pagar agora"}
      </button>
    </form>
  );
}

export default function StripeCardPayment({
  storeId,
  orderId,
  totalReais,
  metodo,
  onSuccess,
  onError,
}: StripeCardPaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [erroInicial, setErroInicial] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    criarPaymentIntent(storeId, orderId, totalReais, metodo)
      .then(({ clientSecret, stripeAccount, publishableKey }) => {
        if (!vivo) return;

        const pk =
          publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!pk || !String(pk).startsWith("pk_")) {
          setErroInicial(
            "Chave publicável da Stripe ausente ou inválida (precisa começar com pk_)."
          );
          return;
        }

        // stripeAccount = a conta do lojista. É o que faz o
        // clientSecret da cobrança direta ser aceito.
        setStripePromise(loadStripe(pk, { stripeAccount }));
        setClientSecret(clientSecret);
      })
      .catch((err) => {
        if (!vivo) return;
        setErroInicial(
          err instanceof Error ? err.message : "Erro ao iniciar pagamento."
        );
      });

    return () => {
      vivo = false;
    };
  }, [storeId, orderId, totalReais, metodo]);

  if (erroInicial) {
    return (
      <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
        {erroInicial}
      </p>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[#6b7280]">
        <Loader2 size={16} className="animate-spin" />
        Preparando pagamento...
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        locale: "pt-BR",
      }}
    >
      <FormularioCartao onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}

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
   * Dados que o cliente JÁ preencheu no passo 1 do checkout.
   *
   * O Pix exige o e-mail do pagador. Sem receber esse dado aqui, o
   * formulário da Stripe pedia o e-mail de novo na tela de
   * pagamento — a pessoa digitava duas vezes a mesma coisa.
   * https://docs.stripe.com/payments/payment-element/control-billing-details-collection
   */
  emailCliente?: string;
  nomeCliente?: string;
  /** Endereço absoluto de volta, caso a Stripe precise redirecionar. */
  returnUrl: string;
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
  emailCliente,
  nomeCliente,
  returnUrl,
  onSuccess,
  onError,
}: {
  emailCliente?: string;
  nomeCliente?: string;
  returnUrl: string;
  onSuccess: (status: string | null) => void;
  onError: (mensagem: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processando, setProcessando] = useState(false);

  const email = emailCliente?.trim() || "";
  const nome = nomeCliente?.trim() || "";

  /**
   * Só esconde o campo de e-mail quando REALMENTE temos um.
   *
   * A regra da Stripe é dura: "If you disable collecting certain
   * fields with the fields option, you must pass that same data to
   * stripe.confirmPayment or we'll reject the payment." Esconder sem
   * ter o dado derrubaria o pagamento — por isso, se o cliente
   * deixou o e-mail em branco no passo 1, o formulário continua
   * pedindo, exatamente como antes.
   */
  const escondeEmail = email !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessando(true);

    // confirmPayment com redirect "if_required": cartão sem 3-D
    // Secure resolve aqui mesmo, sem sair da loja. O return_url fica
    // declarado porque alguns fluxos (3-D Secure, e o Pix em teste)
    // precisam de um endereço de volta — sem ele a Stripe recusa com
    // payment_intent_redirect_confirmation_without_return_url.
    // https://docs.stripe.com/js/payment_intents/confirm_payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: returnUrl,
        ...(escondeEmail
          ? {
              payment_method_data: {
                billing_details: {
                  email,
                  ...(nome ? { name: nome } : {}),
                },
              },
            }
          : {}),
      },
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
      <PaymentElement
        options={{
          // Pré-preenche o que já sabemos. A Stripe usa isto nos
          // campos que ela ainda mostrar.
          defaultValues: {
            billingDetails: {
              ...(email ? { email } : {}),
              ...(nome ? { name: nome } : {}),
            },
          },
          ...(escondeEmail
            ? { fields: { billingDetails: { email: "never" as const } } }
            : {}),
        }}
      />
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
  emailCliente,
  nomeCliente,
  returnUrl,
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
      <FormularioCartao
        emailCliente={emailCliente}
        nomeCliente={nomeCliente}
        returnUrl={returnUrl}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

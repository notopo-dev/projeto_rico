import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { prepararCartao, assinar } from "../lib/assinaturaApi";

/**
 * Formulário do cartão da MENSALIDADE.
 *
 * ----------------------------------------------------------------
 * Diferença para o cartão do checkout da loja
 * ----------------------------------------------------------------
 * No checkout, quem recebe é o lojista: o Stripe.js é criado com
 * `{ stripeAccount }` e a confirmação é `confirmPayment`.
 *
 * Aqui quem recebe é a plataforma, e não estamos cobrando agora —
 * estamos GUARDANDO o cartão para cobrar todo mês. Por isso é
 * `confirmSetup`, sem `stripeAccount`, e é aqui que a autenticação
 * do banco (3-D Secure) acontece, com o lojista presente. Feita
 * uma vez, as renovações passam sozinhas.
 *
 * ----------------------------------------------------------------
 * O nome do provedor não aparece
 * ----------------------------------------------------------------
 * O campo é embutido na página — o lojista não sai do site nem vê
 * tela de terceiro. O SetupIntent é criado travado em cartão
 * (`payment_method_types: ["card"]`), então o formulário não abre
 * abas de outros meios nem de carteira digital.
 */

interface Props {
  /** Chamado quando a assinatura ficou de pé. */
  onPronto: () => void;
  /** Rótulo do botão — muda entre "Assinar" e "Atualizar cartão". */
  rotulo: string;
}

function Formulario({ onPronto, rotulo }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessando(true);
    setErro(null);

    // `redirect: "if_required"`: cartão sem 3-D Secure resolve aqui
    // mesmo. O return_url fica declarado porque alguns bancos
    // redirecionam — sem ele a Stripe recusa a confirmação.
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      setErro(error.message ?? "Não foi possível validar o cartão.");
      setProcessando(false);
      return;
    }

    if (!setupIntent?.id) {
      setErro("Cartão não confirmado. Tente de novo.");
      setProcessando(false);
      return;
    }

    try {
      const r = await assinar(setupIntent.id);

      // O banco pediu autenticação na PRIMEIRA cobrança (acontece
      // quando o teste já venceu e a fatura sai na hora). Terminamos
      // aqui mesmo, sem mandar o lojista para lugar nenhum.
      if (r.precisa_autenticar && r.client_secret) {
        const { error: erro3ds } = await stripe.handleNextAction({
          clientSecret: r.client_secret,
        });
        if (erro3ds) {
          setErro(erro3ds.message ?? "A autenticação do banco não passou.");
          setProcessando(false);
          return;
        }
      }

      onPronto();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível assinar.");
      setProcessando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <PaymentElement options={{ layout: "tabs" }} />

      {erro && (
        <p
          role="alert"
          className="t-apoio text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2"
        >
          {erro}
        </p>
      )}

      <button type="submit" disabled={!stripe || processando} className="btn-app">
        {processando && <Loader2 size={16} className="animate-spin" />}
        {processando ? "Confirmando..." : rotulo}
      </button>

      <p className="t-micro text-[#6b7280] text-center">
        Cobrança mensal de R$ 78,00. Cancele quando quiser.
      </p>
    </form>
  );
}

export default function CartaoAssinatura({ onPronto, rotulo }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    prepararCartao()
      .then(({ clientSecret, publishableKey }) => {
        if (!vivo) return;

        const pk =
          publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!pk || !String(pk).startsWith("pk_")) {
          setErro("Pagamento não configurado. Fale com o suporte.");
          return;
        }

        setStripePromise(loadStripe(pk));
        setClientSecret(clientSecret);
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "Erro ao preparar o cartão.");
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (erro) {
    return (
      <p
        role="alert"
        className="t-apoio text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2"
      >
        {erro}
      </p>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 t-apoio text-[#6b7280]">
        <Loader2 size={16} className="animate-spin" />
        Preparando...
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, locale: "pt-BR" }}>
      <Formulario onPronto={onPronto} rotulo={rotulo} />
    </Elements>
  );
}

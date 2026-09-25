import { supabase } from "../../lib/supabaseClient";

export interface PagamentoIniciado {
  clientSecret: string;
  /** Conta conectada do lojista — necessária no loadStripe. */
  stripeAccount: string;
  /** Chave publicável vinda do backend (evita .env desatualizado). */
  publishableKey: string;
}

/**
 * Chama a Edge Function que cria o PaymentIntent no Stripe.
 *
 * Agora é COBRANÇA DIRETA: o PaymentIntent é criado dentro da conta
 * do lojista, então o Stripe.js do checkout precisa ser inicializado
 * com { stripeAccount } — por isso devolvemos esse dado junto.
 *
 * "metodo" restringe quais formas o Stripe Elements mostra na tela
 * — "pix" mostra só Pix, "card" mostra só cartão.
 */
export async function criarPaymentIntent(
  storeId: string,
  orderId: string,
  totalReais: number,
  metodo: "pix" | "card"
): Promise<PagamentoIniciado> {
  const amountInCents = Math.round(totalReais * 100);

  const { data, error } = await supabase.functions.invoke(
    "stripe-create-payment-intent",
    {
      body: { storeId, orderId, amountInCents, metodo },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  if (!data?.clientSecret || !data?.stripeAccount) {
    throw new Error("Resposta incompleta do servidor de pagamento.");
  }

  return {
    clientSecret: data.clientSecret as string,
    stripeAccount: data.stripeAccount as string,
    publishableKey: (data.publishableKey as string) || "",
  };
}

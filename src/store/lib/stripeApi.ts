import { supabase } from "../../lib/supabaseClient";

/**
 * Chama a Edge Function que cria o PaymentIntent no Stripe
 * (destination charge para a conta do lojista, sem fee).
 * "metodo" restringe quais formas de pagamento o Stripe Elements
 * mostra na tela — "pix" mostra só Pix, "card" mostra só cartão.
 */
export async function criarPaymentIntent(
  storeId: string,
  orderId: string,
  totalReais: number,
  metodo: "pix" | "card"
): Promise<string> {
  const amountInCents = Math.round(totalReais * 100);

  const { data, error } = await supabase.functions.invoke(
    "stripe-create-payment-intent",
    {
      body: { storeId, orderId, amountInCents, metodo },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.clientSecret as string;
}
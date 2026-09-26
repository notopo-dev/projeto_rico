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
 * COBRANÇA DIRETA: o PaymentIntent é criado dentro da conta do
 * lojista, então o Stripe.js do checkout precisa ser inicializado
 * com { stripeAccount } — por isso devolvemos esse dado junto.
 *
 * "metodo" restringe quais formas o Stripe Elements mostra na tela:
 * "pix" mostra só Pix, "card" mostra só cartão.
 *
 * ----------------------------------------------------------------
 * Por que fetch e não supabase.functions.invoke
 * ----------------------------------------------------------------
 * O invoke descarta o corpo da resposta quando o status não é 2xx.
 * O cliente via só "Edge Function returned a non-2xx status code" —
 * e o motivo de verdade ("esta loja ainda não pode receber
 * pagamentos com cartão", "valor não confere com o pedido") morria
 * no caminho. Com fetch, lemos o corpo e mostramos o que aconteceu.
 * É o mesmo padrão já usado no cálculo de frete.
 */
export async function criarPaymentIntent(
  storeId: string,
  orderId: string,
  totalReais: number,
  metodo: "pix" | "card"
): Promise<PagamentoIniciado> {
  const amountInCents = Math.round(totalReais * 100);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/stripe-create-payment-intent`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storeId, orderId, amountInCents, metodo }),
    }
  );

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(
      corpo?.error ?? `Erro ao iniciar o pagamento (status ${res.status}).`
    );
  }

  if (!corpo?.clientSecret || !corpo?.stripeAccount) {
    throw new Error("Resposta incompleta do servidor de pagamento.");
  }

  return {
    clientSecret: corpo.clientSecret as string,
    stripeAccount: corpo.stripeAccount as string,
    publishableKey: (corpo.publishableKey as string) || "",
  };
}

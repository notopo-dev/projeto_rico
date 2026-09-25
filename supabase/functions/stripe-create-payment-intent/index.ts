// ============================================================
// stripe-create-payment-intent
// Cria um PaymentIntent para o checkout da loja pública.
//
// MUDOU: era "destination charge" (o dinheiro passava pela
// plataforma e era repassado). Agora é COBRANÇA DIRETA — o
// cliente paga direto a conta do lojista, via header
// Stripe-Account.
// https://docs.stripe.com/connect/direct-charges
//
// Por quê: a plataforma não cobra % da venda, só mensalidade.
// Na cobrança direta o lojista é o "merchant of record" — é o
// nome dele na fatura do cartão, o chargeback é dele, e a
// plataforma não precisa se enquadrar como instituição de
// pagamento. É o modelo recomendado para SaaS.
//
// Como não há comissão, NÃO enviamos application_fee_amount.
//
// Body: { storeId, orderId, amountInCents, metodo }
// Retorna: { clientSecret, stripeAccount, publishableKey }
//
// ⚠️ O frontend precisa inicializar o Stripe.js apontando para a
//    conta conectada: loadStripe(pk, { stripeAccount }).
//    Sem isso o clientSecret é recusado.
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";

interface RequestBody {
  storeId: string;
  orderId: string;
  amountInCents: number;
  metodo: "pix" | "card";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, orderId, amountInCents, metodo }: RequestBody =
      await req.json();

    if (
      !storeId ||
      !orderId ||
      (metodo !== "pix" && metodo !== "card")
    ) {
      return json({ error: "Dados inválidos para criar o pagamento." }, 400);
    }

    // Service role: quem chama é o CLIENTE FINAL (anônimo, sem login).
    // A segurança é: loja ativa + com Stripe habilitado, e o pedido
    // tem que pertencer a essa loja.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, nome, ativo, stripe_account_id, stripe_charges_enabled")
      .eq("id", storeId)
      .single();

    if (storeError || !store || !store.ativo) {
      return json({ error: "Loja não encontrada ou inativa." }, 404);
    }

    if (!store.stripe_account_id || !store.stripe_charges_enabled) {
      return json(
        { error: "Esta loja ainda não pode receber pagamentos online." },
        400
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, numero, store_id, total, status")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .single();

    if (orderError || !order) {
      return json({ error: "Pedido não encontrado." }, 404);
    }

    if (order.status === "pago") {
      return json({ error: "Este pedido já foi pago." }, 409);
    }

    // O valor que vale é o do BANCO, nunca o que veio do navegador.
    // (o amountInCents recebido serve só de conferência)
    const totalEmCentavos = Math.round(Number(order.total) * 100);

    if (!Number.isFinite(totalEmCentavos) || totalEmCentavos < 50) {
      return json({ error: "Valor do pedido inválido." }, 400);
    }

    if (
      typeof amountInCents === "number" &&
      amountInCents > 0 &&
      totalEmCentavos !== amountInCents
    ) {
      return json(
        { error: "Valor do pagamento não confere com o pedido." },
        400
      );
    }

    // ---- COBRANÇA DIRETA -------------------------------------------
    // O segundo argumento { stripeAccount } é o que manda o
    // PaymentIntent ser criado DENTRO da conta do lojista.
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalEmCentavos,
        currency: "brl",
        payment_method_types: [metodo],
        description: `Pedido #${order.numero} — ${store.nome}`,
        metadata: {
          order_id: order.id,
          store_id: store.id,
          numero: String(order.numero ?? ""),
        },
      },
      {
        stripeAccount: store.stripe_account_id,
        // Reenvio do mesmo pedido não gera cobrança duplicada.
        idempotencyKey: `pi_${order.id}_${totalEmCentavos}_${metodo}`,
      }
    );

    await supabaseAdmin.from("payments").upsert(
      {
        store_id: storeId,
        order_id: orderId,
        transacao_id: paymentIntent.id,
        metodo: metodo === "pix" ? "pix" : "cartao_stripe",
        valor_bruto: order.total,
        taxa: 0,
        valor_liquido: order.total,
        status: "pendente",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_account_id: store.stripe_account_id,
      },
      { onConflict: "stripe_payment_intent_id" }
    );

    return json({
      clientSecret: paymentIntent.client_secret,
      stripeAccount: store.stripe_account_id,
      publishableKey: PUBLISHABLE_KEY,
      valorCentavos: totalEmCentavos,
    });
  } catch (err) {
    console.error("Erro ao criar PaymentIntent:", err);
    return json(
      { error: err instanceof Error ? err.message : "Erro desconhecido." },
      500
    );
  }
});

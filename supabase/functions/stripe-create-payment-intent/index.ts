// ============================================================
// stripe-create-payment-intent
// Cria um PaymentIntent para o checkout da loja pública.
// Usa "destination charge": o dinheiro vai inteiro para a
// conta Connect do lojista (sem application_fee_amount, porque
// a plataforma cobra mensalidade, não comissão por venda).
// https://docs.stripe.com/connect/destination-charges
// https://docs.stripe.com/api/payment_intents/create
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

interface RequestBody {
  storeId: string;
  orderId: string;
  amountInCents: number;
  metodo: "pix" | "card";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, orderId, amountInCents, metodo }: RequestBody = await req.json();

    if (
      !storeId ||
      !orderId ||
      !amountInCents ||
      amountInCents < 50 ||
      (metodo !== "pix" && metodo !== "card")
    ) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos para criar o pagamento." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usa service role aqui: quem chama é o CLIENTE FINAL (anônimo,
    // sem login), então não há sessão de usuário para autenticar —
    // a validação de segurança é: a loja precisa estar ativa e com
    // Stripe habilitado, e o pedido precisa pertencer a essa loja.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, ativo, stripe_account_id, stripe_charges_enabled")
      .eq("id", storeId)
      .single();

    if (storeError || !store || !store.ativo) {
      return new Response(JSON.stringify({ error: "Loja não encontrada ou inativa." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!store.stripe_account_id || !store.stripe_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "Esta loja ainda não pode receber pagamentos com cartão." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, total")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confere se o valor bate com o total do pedido (evita manipulação
    // do valor a partir do navegador do cliente)
    const totalEmCentavos = Math.round(Number(order.total) * 100);
    if (totalEmCentavos !== amountInCents) {
      return new Response(
        JSON.stringify({ error: "Valor do pagamento não confere com o pedido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Destination charge: dinheiro vai para a conta do lojista,
    // sem taxa da plataforma (sem application_fee_amount).
    // payment_method_types restringe à forma escolhida pelo
    // cliente na loja (Pix xor Cartão), em vez de mostrar as
    // duas juntas via automatic_payment_methods.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "brl",
      payment_method_types: [metodo],
      transfer_data: {
        destination: store.stripe_account_id,
      },
      metadata: {
        order_id: order.id,
        store_id: store.id,
      },
    });

    await supabaseAdmin
      .from("payments")
      .insert({
        store_id: storeId,
        order_id: orderId,
        transacao_id: paymentIntent.id,
        metodo: metodo === "pix" ? "pix" : "cartao_stripe",
        valor_bruto: order.total,
        taxa: 0,
        valor_liquido: order.total,
        status: "pendente",
        stripe_payment_intent_id: paymentIntent.id,
      });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao criar PaymentIntent:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// ============================================================
// stripe-webhook
// Recebe eventos do Stripe (checkout do cliente final) e
// atualiza o pedido/pagamento no banco. É a ÚNICA fonte de
// verdade sobre "o pagamento realmente aconteceu" — nunca
// confiar só no retorno do frontend.
// https://docs.stripe.com/webhooks
// https://docs.stripe.com/api/events/types#event_types-payment_intent.succeeded
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Falta assinatura do webhook.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Verificação criptográfica: garante que o evento veio mesmo
    // da Stripe, e não de alguém forjando uma chamada HTTP.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Assinatura de webhook inválida:", err);
    return new Response("Assinatura inválida.", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata.order_id;

        await supabaseAdmin
          .from("payments")
          .update({
            status: "recebido",
            stripe_charge_id:
              typeof pi.latest_charge === "string" ? pi.latest_charge : null,
          })
          .eq("stripe_payment_intent_id", pi.id);

        if (orderId) {
          await supabaseAdmin
            .from("orders")
            .update({ status: "pago" })
            .eq("id", orderId);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await supabaseAdmin
          .from("payments")
          .update({ status: "falhou" })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      case "account.updated": {
        // Atualiza flags da conta Connect do lojista sempre que
        // o status dela mudar (ex: terminou onboarding depois)
        const account = event.data.object as Stripe.Account;
        await supabaseAdmin
          .from("stores")
          .update({
            stripe_charges_enabled: account.charges_enabled,
            stripe_payouts_enabled: account.payouts_enabled,
            stripe_onboarding_completo: account.details_submitted,
          })
          .eq("stripe_account_id", account.id);
        break;
      }

      default:
        // Outros eventos são ignorados de propósito
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro ao processar webhook:", err);
    return new Response("Erro ao processar evento.", { status: 500 });
  }
});
// ============================================================
// stripe-webhook
// Recebe eventos do Stripe e atualiza pedido/pagamento/conta no
// banco. É a ÚNICA fonte de verdade sobre "o pagamento realmente
// aconteceu" — nunca confiar só no retorno do frontend.
// https://docs.stripe.com/webhooks
//
// Trata três famílias de evento:
//   A) v2  — v2.core.account[...].updated
//            -> status da verificação do lojista
//   B) v1 de CONTA CONECTADA (cobrança direta) — payment_intent.*
//            -> marca pedido como pago / falhou
//   C) v1 de assinatura (mensalidade) — invoice.* / subscription.*
//            -> marca a loja como adimplente / inadimplente
//
// ⚠️ No Dashboard, este endpoint precisa estar marcado para receber
//    eventos DE CONTAS CONECTADAS (Connect). Sem isso os
//    payment_intent das cobranças diretas não chegam, porque agora
//    a cobrança acontece na conta do lojista, não na plataforma.
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_VERSION_V2 = "2026-08-26.preview";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

// Se você usa um "event destination" v2 separado, ponha o segredo
// dele em STRIPE_WEBHOOK_SECRET_V2. Se não houver, usamos o mesmo.
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const webhookSecretV2 =
  Deno.env.get("STRIPE_WEBHOOK_SECRET_V2") ?? webhookSecret;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Busca a conta na API v2 (os eventos v2 não trazem o objeto inteiro). */
async function buscarContaV2(accountId: string) {
  const res = await fetch(
    `https://api.stripe.com/v2/core/accounts/${accountId}` +
      `?include[0]=requirements&include[1]=configuration.merchant`,
    {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Stripe-Version": STRIPE_VERSION_V2,
      },
    }
  );
  if (!res.ok) {
    console.error("Falha ao buscar conta v2:", await res.text());
    return null;
  }
  return await res.json();
}

/** Registra o evento; devolve false se já tínhamos processado. */
async function eventoNovo(id: string, tipo: string, payload: unknown) {
  const { error } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id, tipo, payload });

  // 23505 = chave duplicada -> já processamos este evento
  if (error && error.code === "23505") return false;
  return true;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Falta assinatura do webhook.", { status: 400 });
  }

  // Verificação criptográfica: garante que o evento veio mesmo da
  // Stripe. Tenta os dois segredos (endpoint v1 e destination v2).
  let event: any = null;
  for (const segredo of [webhookSecret, webhookSecretV2]) {
    if (!segredo) continue;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        segredo
      );
      break;
    } catch {
      // tenta o próximo
    }
  }

  if (!event) {
    console.error("Assinatura de webhook inválida.");
    return new Response("Assinatura inválida.", { status: 400 });
  }

  const tipo: string = event.type ?? "";
  const eventoId: string = event.id ?? crypto.randomUUID();

  // Idempotência: a Stripe reenvia em caso de timeout.
  if (!(await eventoNovo(eventoId, tipo, event))) {
    return new Response(JSON.stringify({ duplicado: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ================================================================
    // A) Conta conectada (Accounts v2)
    // ================================================================
    if (tipo.startsWith("v2.core.account")) {
      const accountId: string | undefined =
        event.related_object?.id ?? event.data?.id ?? event.context;

      if (accountId) {
        const conta = await buscarContaV2(accountId);

        const entries = conta?.requirements?.entries ?? [];
        const pendentes = entries
          .filter(
            (e: any) =>
              e?.minimum_deadline?.status === "currently_due" ||
              e?.minimum_deadline?.status === "past_due"
          )
          .map((e: any) => ({
            campo: e?.requirement?.field_reference ?? null,
            motivo: e?.description ?? null,
            status: e?.minimum_deadline?.status ?? null,
          }));

        const cardPayments =
          conta?.configuration?.merchant?.capabilities?.card_payments?.status;
        const chargesEnabled = cardPayments === "active";

        await supabaseAdmin
          .from("stores")
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_onboarding_completo:
              chargesEnabled && pendentes.length === 0,
            stripe_requisitos_pendentes: pendentes,
            stripe_atualizado_em: new Date().toISOString(),
          })
          .eq("stripe_account_id", accountId);
      }
    }

    // ================================================================
    // B) Pagamentos das lojas (cobrança direta)
    // ================================================================
    else if (tipo === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.order_id;

      await supabaseAdmin
        .from("payments")
        .update({
          status: "recebido",
          stripe_charge_id:
            typeof pi.latest_charge === "string" ? pi.latest_charge : null,
          erro_mensagem: null,
        })
        .eq("stripe_payment_intent_id", pi.id);

      if (orderId) {
        await supabaseAdmin
          .from("orders")
          .update({ status: "pago" })
          .eq("id", orderId);
      }
    } else if (
      tipo === "payment_intent.payment_failed" ||
      tipo === "payment_intent.canceled"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;

      await supabaseAdmin
        .from("payments")
        .update({
          status: tipo === "payment_intent.canceled" ? "cancelado" : "falhou",
          erro_mensagem: pi.last_payment_error?.message ?? null,
        })
        .eq("stripe_payment_intent_id", pi.id);
    }

    // ================================================================
    // C) Mensalidade da plataforma
    // ================================================================
    else if (tipo === "invoice.paid" || tipo === "invoice.payment_succeeded") {
      const inv = event.data.object as any;
      if (inv.subscription) {
        await supabaseAdmin
          .from("stores")
          .update({
            assinatura_status: "ativa",
            assinatura_proxima_cobranca: inv.period_end
              ? new Date(inv.period_end * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", inv.subscription);
      }
    } else if (tipo === "invoice.payment_failed") {
      const inv = event.data.object as any;
      if (inv.subscription) {
        await supabaseAdmin
          .from("stores")
          .update({ assinatura_status: "inadimplente" })
          .eq("stripe_subscription_id", inv.subscription);
      }
    } else if (tipo === "customer.subscription.deleted") {
      const sub = event.data.object as any;
      await supabaseAdmin
        .from("stores")
        .update({ assinatura_status: "cancelada" })
        .eq("stripe_subscription_id", sub.id);
    } else if (tipo === "customer.subscription.updated") {
      const sub = event.data.object as any;
      const mapa: Record<string, string> = {
        active: "ativa",
        trialing: "ativa",
        past_due: "inadimplente",
        unpaid: "inadimplente",
        canceled: "cancelada",
        incomplete: "incompleta",
        incomplete_expired: "cancelada",
      };
      await supabaseAdmin
        .from("stores")
        .update({
          assinatura_status: mapa[sub.status] ?? "incompleta",
          assinatura_proxima_cobranca: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq("stripe_subscription_id", sub.id);
    }

    // ================================================================
    // Compatibilidade: contas v1 antigas
    // ================================================================
    else if (tipo === "account.updated") {
      const account = event.data.object as Stripe.Account;
      await supabaseAdmin
        .from("stores")
        .update({
          stripe_charges_enabled: account.charges_enabled,
          stripe_payouts_enabled: account.payouts_enabled,
          stripe_onboarding_completo: account.details_submitted,
          stripe_atualizado_em: new Date().toISOString(),
        })
        .eq("stripe_account_id", account.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro ao processar webhook", tipo, err);
    // 200 de propósito: a Stripe pararia de reenviar só depois de
    // muitas tentativas, e o evento já ficou salvo em stripe_events
    // para investigação.
    return new Response(
      JSON.stringify({ received: true, erro: String(err) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});

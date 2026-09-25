// ============================================================
// stripe-assinatura-ativar
// MENSALIDADE DA PLATAFORMA.
// A plataforma não cobra % da venda — cobra mensalidade. Esta
// função cobra essa mensalidade DO SALDO STRIPE do próprio
// lojista, sem pedir cartão de novo.
// https://docs.stripe.com/connect/subscriptions
//
// Faz três coisas, cada uma só se ainda não foi feita:
//   1. Adiciona a configuração "customer" na conta v2 do lojista
//      (no v2 a mesma conta serve de merchant e de customer)
//   2. SetupIntent com "stripe_balance" -> gera um pm_...
//   3. Subscription com customer_account = acct_... e esse pm_
//
// Body: { price_id?: string }  (senão usa STRIPE_PRICE_MENSALIDADE)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const PRICE_PADRAO = Deno.env.get("STRIPE_PRICE_MENSALIDADE") ?? "";
const STRIPE_VERSION = "2026-08-26.preview";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeV1(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data));
  return data;
}

async function stripeV2(path: string, payload: unknown) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? JSON.stringify(data));
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const priceId: string = body.price_id || PRICE_PADRAO;

    if (!priceId.startsWith("price_")) {
      return json(
        {
          error:
            "Preço da mensalidade não configurado. Crie um produto recorrente na Stripe e ponha o price_... em STRIPE_PRICE_MENSALIDADE.",
        },
        400
      );
    }

    const token = (req.headers.get("Authorization") ?? "")
      .replace("Bearer ", "")
      .trim();
    if (!token) return json({ error: "Não autenticado." }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Sessão expirada. Faça login novamente." }, 401);
    }

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select(
        "id, stripe_account_id, stripe_charges_enabled, stripe_billing_habilitado, stripe_payment_method_id, stripe_subscription_id"
      )
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (!store?.stripe_account_id) {
      return json(
        { error: "Conta de recebimento ainda não criada.", code: "sem_conta" },
        409
      );
    }

    if (!store.stripe_charges_enabled) {
      return json(
        {
          error:
            "A conta ainda está em verificação. Conclua a verificação antes de ativar a mensalidade.",
          code: "conta_nao_liberada",
        },
        409
      );
    }

    const accountId = store.stripe_account_id as string;

    // ---- Já existe assinatura? Não cria outra. ----------------------
    if (store.stripe_subscription_id) {
      const res = await fetch(
        `https://api.stripe.com/v1/subscriptions/${store.stripe_subscription_id}`,
        {
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Stripe-Version": STRIPE_VERSION,
          },
        }
      );
      const sub = await res.json();

      if (res.ok && sub?.id && sub.status !== "canceled") {
        return json({
          subscription_id: sub.id,
          status: sub.status,
          proxima_cobranca: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          ja_existia: true,
        });
      }
    }

    // ---- 1. Configuração "customer" na conta v2 ---------------------
    if (!store.stripe_billing_habilitado) {
      try {
        await stripeV2(`/v2/core/accounts/${accountId}`, {
          configuration: {
            customer: {
              capabilities: { automatic_indirect_tax: { requested: true } },
            },
          },
          include: ["configuration.customer"],
        });
      } catch (e) {
        // Se a capacidade de imposto não existir no BR, tenta sem ela.
        console.warn("customer com capabilities falhou, tentando simples:", e);
        await stripeV2(`/v2/core/accounts/${accountId}`, {
          configuration: { customer: {} },
          include: ["configuration.customer"],
        });
      }

      await supabaseAdmin
        .from("stores")
        .update({ stripe_billing_habilitado: true })
        .eq("id", store.id);
    }

    // ---- 2. SetupIntent usando o saldo Stripe do lojista ------------
    let paymentMethodId = store.stripe_payment_method_id as string | null;

    if (!paymentMethodId) {
      const si = await stripeV1("/v1/setup_intents", {
        "allowed_payment_method_types[]": "stripe_balance",
        confirm: "true",
        customer_account: accountId,
        usage: "off_session",
        "payment_method_data[type]": "stripe_balance",
      });

      paymentMethodId =
        typeof si.payment_method === "string"
          ? si.payment_method
          : si.payment_method?.id;

      if (!paymentMethodId) {
        throw new Error(
          `A Stripe não devolveu o método de pagamento do saldo (status: ${si.status}).`
        );
      }

      await supabaseAdmin
        .from("stores")
        .update({ stripe_payment_method_id: paymentMethodId })
        .eq("id", store.id);
    }

    // ---- 3. Assinatura ----------------------------------------------
    const sub = await stripeV1("/v1/subscriptions", {
      customer_account: accountId,
      default_payment_method: paymentMethodId,
      "items[0][price]": priceId,
      "items[0][quantity]": "1",
      "payment_settings[payment_method_types][0]": "stripe_balance",
      "metadata[store_id]": store.id,
    });

    const proxima = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from("stores")
      .update({
        stripe_subscription_id: sub.id,
        assinatura_status: sub.status === "active" ? "ativa" : "incompleta",
        assinatura_proxima_cobranca: proxima,
        assinatura_plano: priceId,
      })
      .eq("id", store.id);

    return json({
      subscription_id: sub.id,
      status: sub.status,
      proxima_cobranca: proxima,
    });
  } catch (err) {
    console.error("stripe-assinatura-ativar:", err);
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500
    );
  }
});

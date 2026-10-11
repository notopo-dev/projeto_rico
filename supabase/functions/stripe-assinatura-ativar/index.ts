// ============================================================
// stripe-assinatura-ativar
//
// Cria a assinatura da MENSALIDADE depois que o lojista salvou o
// cartão na tela (ver stripe-assinatura-iniciar).
//
// ------------------------------------------------------------
// O que mudou em relação à versão anterior
// ------------------------------------------------------------
// A versão anterior cobrava os R$ 78 do SALDO STRIPE do lojista
// (`payment_method_types: stripe_balance`). Isso só funcionava
// para quem já tinha terminado o cadastro da conta de recebimento
// E já tinha vendido o suficiente para ter saldo — ou seja, nunca
// para quem acabou de clicar em "Assinar" na página inicial.
//
// Agora é cartão do lojista, como em qualquer SaaS. Consequência
// boa: dá para assinar antes de configurar o recebimento. Por isso
// as duas exigências antigas (`sem_conta` e `conta_nao_liberada`)
// saíram — elas existiam só por causa do saldo.
//
// ------------------------------------------------------------
// O teste grátis é respeitado
// ------------------------------------------------------------
// Quem assina com teste em andamento não paga pelo tempo que
// ainda falta: a assinatura nasce com `trial_end` no mesmo
// instante que o banco já tinha guardado. Quem assina depois do
// teste vencido paga na hora. Uma regra só, sem pegadinha.
//
// A Stripe não exige mínimo de duração — o limite é 730 dias.
// https://docs.stripe.com/billing/subscriptions/trials/free-trials
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const PRICE_MENSALIDADE = Deno.env.get("STRIPE_PRICE_MENSALIDADE") ?? "";
const STRIPE_VERSION = "2024-12-18.acacia";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripe(path: string, params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    ...(params ? { body: new URLSearchParams(params) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Erro Stripe (${res.status}).`);
  }
  return data;
}

/** Tradução do status da Stripe para o que o banco entende. */
function statusDoBanco(stripeStatus: string): string | null {
  switch (stripeStatus) {
    case "trialing":
    case "active":
      return "ativa";
    case "past_due":
    case "unpaid":
      return "inadimplente";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    // "incomplete" = o cartão ainda precisa de autenticação do banco.
    // Não é assinatura, e também não é fracasso: o navegador vai
    // terminar o 3-D Secure. Até lá o status do banco não muda.
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /**
     * O preço vem do SERVIDOR. Sempre.
     *
     * Esta regra veio da versão anterior e continua valendo: se o
     * price_id pudesse vir do corpo da requisição, qualquer lojista
     * autenticado assinaria o plano de R$ 0 enquanto o painel
     * mostrava plano contratado. O corpo só traz o id do
     * SetupIntent, e mesmo esse é conferido contra a loja.
     */
    if (!PRICE_MENSALIDADE.startsWith("price_")) {
      return json(
        { error: "A mensalidade ainda não está configurada. Fale com o suporte." },
        500,
      );
    }

    const token = (req.headers.get("Authorization") ?? "")
      .replace("Bearer ", "")
      .trim();
    if (!token) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ error: "Sessão expirada. Entre novamente." }, 401);
    }

    const { data: store } = await admin
      .from("stores")
      .select(
        "id, stripe_customer_id, stripe_subscription_id, assinatura_status, teste_termina_em",
      )
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (!store) return json({ error: "Loja não encontrada." }, 404);
    if (!store.stripe_customer_id) {
      return json(
        { error: "Comece pelo cartão antes de assinar.", code: "sem_cartao" },
        409,
      );
    }

    // ---- Já existe assinatura? Não cria outra. -------------------
    if (store.stripe_subscription_id) {
      try {
        const sub = await stripe(
          `/v1/subscriptions/${store.stripe_subscription_id}`,
        );
        if (sub?.id && sub.status !== "canceled") {
          return json({
            subscription_id: sub.id,
            status: sub.status,
            ja_existia: true,
          });
        }
      } catch {
        // Assinatura some do lado da Stripe (ambiente trocado, por
        // exemplo): segue e cria outra em vez de travar o lojista.
      }
    }

    // ---- O cartão que o lojista acabou de salvar -----------------
    const corpo = await req.json().catch(() => ({}));
    const setupIntentId = String(corpo?.setup_intent_id ?? "").trim();

    if (!setupIntentId.startsWith("seti_")) {
      return json({ error: "Cartão não identificado." }, 400);
    }

    const si = await stripe(`/v1/setup_intents/${setupIntentId}`);

    // A conferência que importa: este SetupIntent é DESTA loja?
    // Sem ela, um lojista mandaria o seti_ de outro e assinaria no
    // cartão alheio.
    if (si.customer !== store.stripe_customer_id) {
      console.error("SetupIntent de outro cliente recusado", {
        store_id: store.id,
      });
      return json({ error: "Cartão não confere com esta loja." }, 403);
    }

    if (si.status !== "succeeded") {
      return json(
        { error: "O cartão ainda não foi confirmado. Tente de novo." },
        409,
      );
    }

    const paymentMethodId =
      typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id;

    if (!paymentMethodId) {
      return json({ error: "Cartão não identificado." }, 409);
    }

    // Vira o cartão padrão do cliente: é dele que saem as faturas
    // dos meses seguintes, sem ninguém na frente da tela.
    await stripe(`/v1/customers/${store.stripe_customer_id}`, {
      "invoice_settings[default_payment_method]": paymentMethodId,
    });

    // ---- Quanto ainda falta do teste -----------------------------
    const fimDoTeste =
      store.assinatura_status === "teste" && store.teste_termina_em
        ? Math.floor(new Date(store.teste_termina_em).getTime() / 1000)
        : 0;
    const agora = Math.floor(Date.now() / 1000);
    const aindaEmTeste = fimDoTeste > agora;

    // ---- A assinatura -------------------------------------------
    // `default_incomplete` em vez de falhar na hora: se o banco
    // pedir autenticação (3-D Secure), a fatura volta com um
    // PaymentIntent e o navegador termina na mesma tela. Falhar
    // aqui faria o lojista achar que o cartão foi recusado.
    const sub = await stripe("/v1/subscriptions", {
      customer: store.stripe_customer_id,
      "items[0][price]": PRICE_MENSALIDADE,
      "items[0][quantity]": "1",
      default_payment_method: paymentMethodId,
      payment_behavior: "default_incomplete",
      "payment_settings[save_default_payment_method]": "on_subscription",
      "expand[]": "latest_invoice.payment_intent",
      "metadata[store_id]": store.id,
      ...(aindaEmTeste ? { trial_end: String(fimDoTeste) } : {}),
    });

    const novoStatus = statusDoBanco(sub.status);
    const proxima = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    await admin
      .from("stores")
      .update({
        stripe_subscription_id: sub.id,
        stripe_payment_method_id: paymentMethodId,
        assinatura_plano: PRICE_MENSALIDADE,
        assinatura_proxima_cobranca: proxima,
        ...(novoStatus ? { assinatura_status: novoStatus } : {}),
      })
      .eq("id", store.id);

    // Só o client_secret da fatura sobe para o navegador — e ele é
    // público por desenho, serve só para aquele pagamento.
    const pi = sub.latest_invoice?.payment_intent;

    return json({
      subscription_id: sub.id,
      status: sub.status,
      em_teste: aindaEmTeste,
      proxima_cobranca: proxima,
      precisa_autenticar: pi?.status === "requires_action",
      client_secret: pi?.status === "requires_action" ? pi.client_secret : null,
    });
  } catch (err) {
    console.error("stripe-assinatura-ativar:", err);
    return json(
      {
        error:
          err instanceof Error ? err.message : "Não foi possível assinar.",
      },
      500,
    );
  }
});

// ============================================================
// stripe-account-session
// Cria uma AccountSession para renderizar o ONBOARDING EMBUTIDO
// da Stripe dentro do nosso próprio site (Connect embedded
// components), em vez de redirecionar o lojista para fora.
//
// Por que existe: selfie (proof_of_liveness) e aceite dos termos
// (tos_acceptance) NÃO têm endpoint de API — só a Stripe pode
// coletar. O componente embutido resolve os dois sem tirar o
// lojista do nosso painel.
// https://docs.stripe.com/connect/embedded-onboarding
//
// Retorna: { client_secret, account_id, publishable_key }
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";

// Versão preview exigida pelo Accounts v2
const STRIPE_VERSION = "2026-08-26.preview";

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
    // ---- 1. Autenticar o lojista -----------------------------------
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

    // ---- 2. Loja do usuário ----------------------------------------
    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("id, nome, stripe_account_id")
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (storeErr) return json({ error: storeErr.message }, 400);
    if (!store) return json({ error: "Loja não encontrada." }, 404);

    if (!store.stripe_account_id) {
      return json(
        {
          error:
            "Conta de recebimento ainda não criada. Preencha os dados básicos antes.",
          code: "sem_conta",
        },
        409
      );
    }

    // ---- 3. AccountSession -----------------------------------------
    // Como a conta é dashboard: "none", a plataforma é responsável
    // pela coleta — por isso ligamos também a coleta de conta bancária
    // dentro do componente.
    const params = new URLSearchParams({
      account: store.stripe_account_id,
      "components[account_onboarding][enabled]": "true",
      "components[account_onboarding][features][external_account_collection]":
        "true",
      // Não é possível desligar a autenticação da Stripe aqui.
      // A flag disable_stripe_user_authentication só é aceita quando a
      // PLATAFORMA é dona da coleta de requisitos, o que exige criar as
      // contas com responsibilities application/application — e isso faria
      // as taxas de processamento passarem pelo nosso saldo.
      // Com stripe/stripe (nosso caso), a Stripe conduz a identidade e
      // abre uma janela própria nessa etapa. O resto do cadastro continua
      // dentro do nosso painel.
      "components[payments][enabled]": "true",
      "components[payments][features][refund_management]": "true",
      "components[payments][features][dispute_management]": "true",
      "components[payouts][enabled]": "true",
      "components[payouts][features][external_account_collection]": "true",
      // A Stripe exige estes componentes quando ela é responsável pelos
      // saldos negativos (nosso caso): banner de notificação e
      // gerenciamento de conta. Os demais completam o painel do lojista.
      "components[account_management][enabled]": "true",
      "components[account_management][features][external_account_collection]":
        "true",
      "components[notification_banner][enabled]": "true",
      "components[notification_banner][features][external_account_collection]":
        "true",
      "components[balances][enabled]": "true",
      "components[balances][features][external_account_collection]": "true",
      "components[documents][enabled]": "true",
    });

    const res = await fetch("https://api.stripe.com/v1/account_sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_VERSION,
      },
      body: params,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("account_sessions erro:", data);
      return json(
        { error: data?.error?.message ?? "Erro ao abrir o formulário." },
        400
      );
    }

    return json({
      client_secret: data.client_secret,
      account_id: store.stripe_account_id,
      publishable_key: STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error("stripe-account-session:", err);
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500
    );
  }
});

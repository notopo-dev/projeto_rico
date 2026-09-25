// ============================================================
// stripe-account-link
// PLANO B do onboarding: link hospedado pela Stripe.
// Usado quando o componente embutido não abre (iframe bloqueado,
// conta muito nova) ou quando o lojista quer editar dados já
// enviados.
// https://docs.stripe.com/api/v2/core/account_links
//
// Body: { tipo?: "onboarding" | "atualizar" }
// Retorna: { url }
//
// Cada link só pode ser usado UMA vez, e o return_url NÃO garante
// que tudo foi preenchido — quem confirma é o webhook.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://moneynotopo.com.br";
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
    const { tipo = "onboarding" } = await req.json().catch(() => ({}));

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
      .select("id, stripe_account_id")
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    if (!store?.stripe_account_id) {
      return json(
        { error: "Conta de recebimento ainda não criada.", code: "sem_conta" },
        409
      );
    }

    const returnUrl = `${APP_URL}/configuracoes?stripe=retorno`;
    const refreshUrl = `${APP_URL}/configuracoes?stripe=recarregar`;

    // ⚠️ As configurações pedidas aqui têm que ser EXATAMENTE as que a
    // conta já tem aplicadas, senão a Stripe recusa com
    // "The configurations in the request must match the applied
    // configurations on the account".
    // A nossa stripe-custom-create-account cria com merchant + recipient,
    // mas em vez de fixar no código lemos da própria conta.
    const contaRes = await fetch(
      `https://api.stripe.com/v2/core/accounts/${store.stripe_account_id}` +
        `?include[0]=configuration.merchant&include[1]=configuration.recipient` +
        `&include[2]=configuration.customer`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Stripe-Version": STRIPE_VERSION,
        },
      }
    );

    const conta = await contaRes.json();

    if (!contaRes.ok) {
      console.error("Falha ao ler a conta:", conta);
      return json(
        { error: conta?.error?.message ?? "Não foi possível ler a conta." },
        400
      );
    }

    const configuracoes = ["merchant", "recipient", "customer"].filter(
      (c) => conta?.configuration?.[c] != null
    );

    if (configuracoes.length === 0) configuracoes.push("merchant");

    const useCase =
      tipo === "atualizar"
        ? {
            type: "account_update",
            account_update: {
              configurations: configuracoes,
              return_url: returnUrl,
              refresh_url: refreshUrl,
            },
          }
        : {
            type: "account_onboarding",
            account_onboarding: {
              // eventually_due = pede tudo de uma vez; evita o lojista
              // voltar várias vezes e evita bloqueio de repasse depois.
              collection_options: { fields: "eventually_due" },
              configurations: configuracoes,
              return_url: returnUrl,
              refresh_url: refreshUrl,
            },
          };

    const res = await fetch("https://api.stripe.com/v2/core/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Stripe-Version": STRIPE_VERSION,
      },
      body: JSON.stringify({
        account: store.stripe_account_id,
        use_case: useCase,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("account_links erro:", data);
      return json(
        { error: data?.error?.message ?? "Erro ao gerar o link." },
        400
      );
    }

    return json({ url: data.url, expires_at: data.expires_at ?? null });
  } catch (err) {
    console.error("stripe-account-link:", err);
    return json(
      { error: err instanceof Error ? err.message : "Erro inesperado." },
      500
    );
  }
});
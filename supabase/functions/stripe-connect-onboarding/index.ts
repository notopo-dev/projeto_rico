// ============================================================
// stripe-connect-onboarding
// Cria (ou reaproveita) a conta Stripe Express do lojista e
// devolve o link de onboarding oficial da Stripe.
// Documentação seguida:
// https://docs.stripe.com/connect/express-accounts
// https://docs.stripe.com/api/account_links
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente Supabase autenticado como o usuário que chamou a função,
    // para respeitar RLS e identificar a loja correta com segurança.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, nome, email, stripe_account_id")
      .eq("owner_id", user.id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accountId = store.stripe_account_id as string | null;

    // 1. Cria a conta Express se ainda não existir
    // https://docs.stripe.com/api/accounts/create
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: store.email ?? undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { store_id: store.id },
      });

      accountId = account.id;

      // Usa o service role para gravar (bypass de RLS controlado,
      // só dentro desta function autenticada e já validada acima)
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseAdmin
        .from("stores")
        .update({ stripe_account_id: accountId })
        .eq("id", store.id);
    }

    // 2. Cria o Account Link — o formulário de onboarding hospedado
    // pela própria Stripe (KYC, dados bancários, etc.)
    // https://docs.stripe.com/api/account_links/create
    const origin = req.headers.get("origin") ?? Deno.env.get("APP_URL")!;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/configuracoes?stripe=refresh`,
      return_url: `${origin}/configuracoes?stripe=return`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro no onboarding Stripe:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
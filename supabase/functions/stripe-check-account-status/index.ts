// ============================================================
// stripe-check-account-status
// Consulta a conta Stripe Connect do lojista e atualiza as
// flags locais (charges_enabled, payouts_enabled, onboarding
// completo). Chamada quando o lojista volta do onboarding.
// https://docs.stripe.com/api/accounts/retrieve
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id, stripe_account_id")
      .eq("owner_id", user.id)
      .single();

    if (!store?.stripe_account_id) {
      return new Response(
        JSON.stringify({ conectado: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = await stripe.accounts.retrieve(store.stripe_account_id);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabaseAdmin
      .from("stores")
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_onboarding_completo: account.details_submitted,
      })
      .eq("id", store.id);

    return new Response(
      JSON.stringify({
        conectado: true,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        onboarding_completo: account.details_submitted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao checar conta Stripe:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// ============================================================
// stripe-custom-status
// Consulta o estado REAL da conta Connect do lojista na Stripe
// e devolve tudo que o painel precisa para mostrar a situação
// atual, permitir retomar o cadastro de onde parou, e exibir
// os dados já preenchidos para edição.
// https://docs.stripe.com/api/v2/core/accounts
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

async function stripeV2Fetch(path: string) {
  const res = await fetch(`https://api.stripe.com/v2${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Stripe-Version": "2026-08-26.preview",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? data?.message ?? `Erro Stripe (status ${res.status})`
    );
  }
  return data;
}

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
      .select("id, stripe_account_id, stripe_tipo_pessoa, stripe_documento_enviado")
      .eq("owner_id", user.id)
      .single();

    // Nunca iniciou o cadastro
    if (!store?.stripe_account_id) {
      return new Response(
        JSON.stringify({ situacao: "nao_iniciado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conta = await stripeV2Fetch(
      `/core/accounts/${store.stripe_account_id}?include[0]=identity&include[1]=configuration.merchant&include[2]=configuration.recipient&include[3]=requirements`
    );

    const chargesEnabled =
      conta.configuration?.merchant?.capabilities?.card_payments?.status === "active";
    const payoutsEnabled =
      conta.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
        ?.status === "active";

    const requisitos =
      conta.requirements?.entries?.map((r: any) => ({
        // Na v2, o nome do campo pendente vem em "description"
        campo: r.description ?? r.requirement ?? r.field ?? null,
        motivo: r.awaiting_action_from ?? null,
      })) ?? [];

    // Dados já preenchidos (para o lojista ver e editar)
    const identidade = conta.identity ?? {};
    const individual = identidade.individual ?? null;
    const empresa = identidade.business_details ?? null;

    // Conta bancária cadastrada (via external_accounts v1, que é
    // onde ela vive, já que a Vault v2 ainda não cobre o Brasil)
    let contaBancaria = null;
    try {
      const eaRes = await fetch(
        `https://api.stripe.com/v1/accounts/${store.stripe_account_id}/external_accounts?object=bank_account&limit=1`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
      );
      const eaData = await eaRes.json();
      if (eaRes.ok && eaData?.data?.length > 0) {
        const banco = eaData.data[0];
        contaBancaria = {
          banco_nome: banco.bank_name ?? null,
          ultimos_digitos: banco.last4 ?? null,
          agencia: banco.routing_number ?? null,
          titular: banco.account_holder_name ?? null,
        };
      }
    } catch {
      // Sem conta bancária cadastrada ainda — não é erro
    }

    let situacao: string;
    if (chargesEnabled && payoutsEnabled) {
      situacao = "ativo";
    } else if (requisitos.length > 0) {
      situacao = "pendencias";
    } else if (store.stripe_documento_enviado) {
      situacao = "em_analise";
    } else {
      situacao = "incompleto";
    }

    return new Response(
      JSON.stringify({
        situacao,
        accountId: store.stripe_account_id,
        tipoPessoa: store.stripe_tipo_pessoa,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        requisitos,
        documento_enviado: store.stripe_documento_enviado,
        dados: {
          individual: individual
            ? {
                nome: individual.given_name ?? null,
                sobrenome: individual.surname ?? null,
                email: individual.email ?? null,
                telefone: individual.phone ?? null,
                endereco: individual.address ?? null,
              }
            : null,
          empresa: empresa
            ? {
                razao_social: empresa.registered_name ?? null,
                telefone: empresa.phone ?? null,
                endereco: empresa.registered_address ?? null,
              }
            : null,
          conta_bancaria: contaBancaria,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao consultar status:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
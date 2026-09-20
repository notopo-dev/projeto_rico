// ============================================================
// stripe-custom-create-account (Accounts v2)
// Cria e atualiza a conta Connect do lojista usando a API v2
// de Accounts, recomendada pela Stripe para integrações novas.
// Chamada via fetch direto contra a API REST v2.
//
// Documentação seguida:
// https://docs.stripe.com/api/v2/core/accounts
// https://docs.stripe.com/connect/accounts-v2/account-creation
// https://docs.stripe.com/connect/custom-accounts
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_API_BASE = "https://api.stripe.com/v2";

/**
 * Chama a API v2 da Stripe (JSON puro, diferente da v1 que usa
 * form-urlencoded). Documentação:
 * https://docs.stripe.com/api/v2/core/accounts
 */
async function stripeV2Fetch(
  path: string,
  method: "POST" | "GET",
  body?: Record<string, unknown>
) {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Stripe-Version": "2026-08-26.preview",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const mensagem =
      data?.error?.message ?? data?.message ?? `Erro Stripe (status ${res.status})`;
    throw new Error(mensagem);
  }
  return data;
}

interface EnderecoInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: "BR";
}

interface PessoaFisicaInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: { day: number; month: number; year: number };
  address: EnderecoInput;
  tax_id_individual: string;
  political_exposure?: "existing" | "none";
}

interface PessoaJuridicaInput {
  name: string;
  tax_id: string;
  phone: string;
  address: EnderecoInput;
  representative: PessoaFisicaInput;
}

interface RequestBody {
  tipoPessoa: "individual" | "company";
  individual?: PessoaFisicaInput;
  company?: PessoaJuridicaInput;
  contaBancaria?: {
    account_holder_name: string;
    account_number: string;
    routing_number: string;
  };
  aceiteTermos?: boolean;
  // Perfil do negócio, exigido pela Stripe para liberar as
  // capabilities (aparece em requirements como
  // defaults.profile.* e configuration.merchant.*)
  mcc?: string;
  telefoneSuporte?: string;
  urlNegocio?: string;
  descricaoProduto?: string;
  faturamentoMensalCentavos?: number;
}

function extrairIpCliente(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const candidato = forwarded?.split(",")[0]?.trim();
  const ipv4Valido = candidato && /^\d{1,3}(\.\d{1,3}){3}$/.test(candidato);
  const ipv6Valido = candidato && candidato.includes(":");
  return ipv4Valido || ipv6Valido ? candidato! : null;
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
      .select("id, stripe_account_id, slug, descricao, whatsapp, nome")
      .eq("owner_id", user.id)
      .single();

    if (storeError || !store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    let accountId = store.stripe_account_id as string | null;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ------------------------------------------------------------
    // 1. Cria a conta v2 se ainda não existir
    // https://docs.stripe.com/api/v2/core/accounts/create
    // ------------------------------------------------------------
    if (!accountId) {
      const email =
        body.tipoPessoa === "individual"
          ? body.individual?.email
          : body.company?.representative?.email;

      const ipCliente = extrairIpCliente(req);

      const account = await stripeV2Fetch("/core/accounts", "POST", {
        contact_email: email,
        display_name:
          body.tipoPessoa === "individual"
            ? `${body.individual?.first_name ?? ""} ${body.individual?.last_name ?? ""}`.trim()
            : body.company?.name,
        dashboard: "none", // lojista não acessa o Dashboard da Stripe — tudo pelo seu site
        identity: {
          country: "BR",
          entity_type: body.tipoPessoa === "individual" ? "individual" : "company",
          // Aceite dos termos de serviço da Stripe. Na v2 fica em
          // identity.attestations.terms_of_service.account, e é
          // obrigatório para liberar as capabilities.
          ...(ipCliente
            ? {
                attestations: {
                  terms_of_service: {
                    account: {
                      date: new Date().toISOString(),
                      ip: ipCliente,
                    },
                  },
                },
              }
            : {}),
        },
        defaults: {
          currency: "brl",
          responsibilities: {
            // Stripe cobra as taxas de processamento diretamente do
            // lojista e assume o risco de saldo negativo/estornos —
            // a plataforma não fica exposta a esse risco nem
            // precisa repassar cobrança manual de taxas.
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
          locales: ["pt-BR"],
   
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        include: ["identity", "configuration.merchant", "configuration.recipient"],
      });

      accountId = account.id;

      await supabaseAdmin
        .from("stores")
        .update({
          stripe_account_id: accountId,
          stripe_tipo_pessoa: body.tipoPessoa,
        })
        .eq("id", store.id);
    }

    // ------------------------------------------------------------
    // 2. Atualiza identidade (pessoa física ou jurídica)
    // https://docs.stripe.com/api/v2/core/accounts/update
    // ------------------------------------------------------------
    if (body.tipoPessoa === "individual" && body.individual) {
      const p = body.individual;
      await stripeV2Fetch(`/core/accounts/${accountId}`, "POST", {
        identity: {
          country: "BR",
          entity_type: "individual",
          individual: {
            given_name: p.first_name,
            surname: p.last_name,
            email: p.email,
            phone: p.phone,
            date_of_birth: p.dob,
            address: {
              line1: p.address.line1,
              line2: p.address.line2,
              city: p.address.city,
              state: p.address.state,
              postal_code: p.address.postal_code,
              country: "BR",
            },
            id_numbers: [
              { type: "br_cpf", value: p.tax_id_individual },
            ],
            political_exposure: p.political_exposure ?? "none",
          },
        },
        include: ["identity"],
      });
    }

    if (body.tipoPessoa === "company" && body.company) {
      const c = body.company;
      const rep = c.representative;

      await stripeV2Fetch(`/core/accounts/${accountId}`, "POST", {
        identity: {
          country: "BR",
          entity_type: "company",
          business_details: {
            registered_name: c.name,
            id_numbers: [{ type: "br_cnpj", value: c.tax_id }],
            phone: c.phone,
            registered_address: {
              line1: c.address.line1,
              line2: c.address.line2,
              city: c.address.city,
              state: c.address.state,
              postal_code: c.address.postal_code,
              country: "BR",
            },
          },
        },
        include: ["identity"],
      });

      // Representante legal: na v2, pessoas associadas à conta
      // são gerenciadas via /v2/core/accounts/{id}/people
      // https://docs.stripe.com/api/v2/core/account_person
      await stripeV2Fetch(`/core/accounts/${accountId}/people`, "POST", {
        given_name: rep.first_name,
        surname: rep.last_name,
        email: rep.email,
        phone: rep.phone,
        date_of_birth: rep.dob,
        address: {
          line1: rep.address.line1,
          line2: rep.address.line2,
          city: rep.address.city,
          state: rep.address.state,
          postal_code: rep.address.postal_code,
          country: "BR",
        },
        id_numbers: [{ type: "br_cpf", value: rep.tax_id_individual }],
        relationship: { representative: true },
      });
    }

    // ------------------------------------------------------------
    // 2b. Perfil do negócio — preenchido automaticamente com os
    // dados que a loja já tem cadastrados, para o lojista não
    // precisar digitar de novo. Exigido pela Stripe para liberar
    // as capabilities (requirements: defaults.profile.* e
    // configuration.merchant.*).
    // ------------------------------------------------------------
    {
      const origem = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "";

      // A Stripe rejeita URLs não públicas (localhost, IPs locais,
      // .local). Nesse caso é melhor não enviar o campo do que
      // quebrar toda a atualização do perfil — a URL fica pendente
      // até a loja estar num domínio real.
      const ehUrlPublica =
        origem.startsWith("https://") &&
        !origem.includes("localhost") &&
        !origem.includes("127.0.0.1") &&
        !origem.includes(".local");

      const urlNegocio =
        body.urlNegocio ??
        (ehUrlPublica && store.slug ? `${origem}/loja/${store.slug}` : null);

      const descricaoProduto =
        body.descricaoProduto ??
        store.descricao ??
        `Produtos vendidos pela loja ${store.nome ?? ""}`.trim();

      // A Stripe exige telefone em formato E.164 (+55...)
      const telefoneBruto = body.telefoneSuporte ?? store.whatsapp ?? null;
      const telefoneSuporte = telefoneBruto
        ? (() => {
            const digitos = telefoneBruto.replace(/\D/g, "");
            if (!digitos) return null;
            return digitos.startsWith("55") ? `+${digitos}` : `+55${digitos}`;
          })()
        : null;

      const perfilPayload: Record<string, unknown> = {
        defaults: {
          profile: {
            ...(urlNegocio ? { business_url: urlNegocio } : {}),
            ...(descricaoProduto ? { product_description: descricaoProduto } : {}),
          },
        },
        identity: {
          business_details: {
            // Faturamento mensal estimado, exigido pela Stripe.
            // Valor em centavos. Usa o informado ou um padrão
            // conservador de R$ 5.000/mês.
            monthly_estimated_revenue: {
              amount: body.faturamentoMensalCentavos ?? 500000,
              currency: "brl",
            },
          },
        },
        configuration: {
          merchant: {
            mcc: body.mcc ?? "5691",
            ...(telefoneSuporte ? { support_phone: telefoneSuporte } : {}),
          },
        },
        include: ["defaults", "configuration.merchant", "identity"],
      };

      try {
        await stripeV2Fetch(`/core/accounts/${accountId}`, "POST", perfilPayload);
      } catch (errPerfil) {
        // Perfil do negócio é complementar: se a Stripe recusar
        // algum campo aqui (ex: URL inválida em ambiente local),
        // registramos e seguimos — o cadastro principal do
        // lojista não deve travar por causa disso. O campo
        // aparecerá em "informações pendentes" no painel.
        console.error("Perfil do negócio não pôde ser salvo:", errPerfil);
      }
    }

    // ------------------------------------------------------------
    // 3. Conta bancária: a Vault v2 ainda NÃO tem endpoint dedicado
    // para contas bancárias brasileiras (só US e GB até agora).
    // A própria Stripe permite usar endpoints v1 em uma conta v2
    // (o ID da conta v2 funciona em endpoints v1 clássicos), então
    // usamos o External Accounts v1, testado e estável para o Brasil.
    // https://docs.stripe.com/api/external_account_bank_accounts/create
    // ------------------------------------------------------------
    if (body.contaBancaria) {
      const eaRes = await fetch(
        `https://api.stripe.com/v1/accounts/${accountId}/external_accounts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "external_account[object]": "bank_account",
            "external_account[country]": "BR",
            "external_account[currency]": "brl",
            "external_account[account_holder_name]": body.contaBancaria.account_holder_name,
            "external_account[account_holder_type]":
              body.tipoPessoa === "company" ? "company" : "individual",
            "external_account[account_number]": body.contaBancaria.account_number,
            "external_account[routing_number]": body.contaBancaria.routing_number,
          }),
        }
      );

      const externalAccount = await eaRes.json();
      if (!eaRes.ok) {
        throw new Error(
          externalAccount?.error?.message ?? "Erro ao registrar conta bancária."
        );
      }
    }

    // ------------------------------------------------------------
    // 4. Aceite de termos — TEMPORARIAMENTE DESATIVADO.
    // A estrutura correta de tos_acceptance na Accounts v2 ainda
    // não foi confirmada (configuration.merchant.tos_acceptance
    // não existe, segundo a própria API). Precisa ser retomado
    // antes de ir para produção, consultando a doc oficial da
    // Stripe para o local certo desse campo em v2.
    // ------------------------------------------------------------
    // const ipCliente = extrairIpCliente(req);
    // if (body.aceiteTermos && ipCliente) { ... }

    // ------------------------------------------------------------
    // 5. Consulta estado atual para saber o que falta
    // ------------------------------------------------------------
    const account = await stripeV2Fetch(
      `/core/accounts/${accountId}?include[0]=configuration.merchant&include[1]=configuration.recipient&include[2]=requirements`,
      "GET"
    );

    const chargesEnabled =
      account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
    const payoutsEnabled =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
    const requisitosPendentes =
      account.requirements?.entries?.map((r: any) => r.requirement) ?? [];

    await supabaseAdmin
      .from("stores")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_completo: requisitosPendentes.length === 0,
        stripe_requisitos_pendentes: requisitosPendentes,
      })
      .eq("id", store.id);

    return new Response(
      JSON.stringify({
        accountId,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        requisitos_pendentes: requisitosPendentes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao criar/atualizar conta v2:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
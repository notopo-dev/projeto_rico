// ============================================================
// stripe-assinatura-iniciar
//
// Prepara o campo de cartão da MENSALIDADE da plataforma.
//
// ------------------------------------------------------------
// Por que um SetupIntent e não uma cobrança
// ------------------------------------------------------------
// A mensalidade se repete todo mês. O que precisamos agora não é
// cobrar — é GUARDAR o cartão com o consentimento do lojista, para
// poder cobrar sozinhos depois (`usage: off_session`). É também
// aqui que a autenticação do banco (3-D Secure) acontece, com o
// lojista na frente da tela. Feita agora, as cobranças seguintes
// passam sem ninguém precisar estar presente.
// https://docs.stripe.com/payments/save-and-reuse
//
// ------------------------------------------------------------
// Esta cobrança NÃO é da conta conectada
// ------------------------------------------------------------
// As vendas da loja são cobrança direta, na conta do lojista. A
// mensalidade é o contrário: quem recebe é a plataforma. Então
// aqui não entra `stripeAccount` em lugar nenhum — o lojista é um
// cliente comum da nossa conta.
//
// Nada de segredo sai daqui: devolvemos o client_secret do
// SetupIntent (que é público por desenho e só serve para esse
// intent) e a chave publicável.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PUBLISHABLE_KEY = Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "";
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
    // A mensagem da Stripe é segura para mostrar (ela é escrita
    // para o usuário final). O corpo inteiro, não — pode trazer
    // id de objeto nosso. Por isso só a mensagem sobe.
    throw new Error(data?.error?.message ?? `Erro Stripe (${res.status}).`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!STRIPE_PUBLISHABLE_KEY.startsWith("pk_")) {
      return json(
        { error: "Pagamento ainda não configurado. Fale com o suporte." },
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
    const user = userData.user;

    // A loja vem do DONO, nunca do corpo da requisição. Se viesse
    // do corpo, um lojista assinava no lugar de outro.
    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, nome, stripe_customer_id, assinatura_status, stripe_subscription_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (storeErr) throw storeErr;
    if (!store) return json({ error: "Loja não encontrada." }, 404);

    if (store.stripe_subscription_id && store.assinatura_status === "ativa") {
      return json({ error: "Esta loja já tem assinatura ativa." }, 409);
    }

    // ---- Cliente na conta da plataforma --------------------------
    // Reaproveita o que já existe. Se o id guardado não valer mais
    // (conta trocada, ambiente de teste virando produção), criamos
    // outro em vez de quebrar — o id velho simplesmente deixa de
    // ser usado.
    let customerId = store.stripe_customer_id as string | null;

    if (customerId) {
      try {
        const c = await stripe(`/v1/customers/${customerId}`);
        if (c?.deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const cliente = await stripe("/v1/customers", {
        email: user.email ?? "",
        name: store.nome ?? "",
        "metadata[store_id]": store.id,
      });
      customerId = cliente.id as string;

      await admin
        .from("stores")
        .update({ stripe_customer_id: customerId })
        .eq("id", store.id);
    }

    // ---- SetupIntent ---------------------------------------------
    // `payment_method_types[]=card` de propósito: trava o formulário
    // em cartão e evita que a Stripe ofereça meios que não servem
    // para cobrança automática mensal.
    const si = await stripe("/v1/setup_intents", {
      customer: customerId,
      "payment_method_types[]": "card",
      usage: "off_session",
      "metadata[store_id]": store.id,
    });

    return json({
      clientSecret: si.client_secret,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    // O erro vai para o log do servidor; para o lojista vai só a
    // mensagem. Nenhuma chave passa por aqui.
    console.error("stripe-assinatura-iniciar:", err);
    return json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível preparar o pagamento.",
      },
      500,
    );
  }
});

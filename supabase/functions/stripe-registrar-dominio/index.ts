// ============================================================
// stripe-registrar-dominio
// Libera as carteiras digitais (Apple Pay, Google Pay) no
// checkout da loja.
//
// POR QUE PRECISA DISSO
// Apple Pay e Google Pay não são "formas de pagamento" separadas
// na API: não existe payment_method_type para elas. São maneiras
// de entregar um CARTÃO. O Payment Element mostra os botões
// sozinho — mas só num domínio registrado na Stripe.
//
// E em COBRANÇA DIRETA quem precisa ter o domínio registrado é a
// conta CONECTADA, não a plataforma. A documentação é explícita:
// "Connect platforms that create direct charges must use the API
// to manage domains for their connected accounts, not the Stripe
// Dashboard." Daí o header Stripe-Account abaixo.
// https://docs.stripe.com/payments/payment-methods/pmd-registration
//
// SEGURANÇA
// O domínio NÃO vem do navegador. Vem do APP_URL configurado no
// servidor. Se viesse de fora, um lojista poderia registrar o
// domínio de outra pessoa na própria conta e receber os botões
// de carteira num site que não é dele.
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** O domínio onde a loja roda, tirado do APP_URL do servidor. */
function dominioDaPlataforma(): string | null {
  const bruto = Deno.env.get("APP_URL");
  if (!bruto) return null;
  try {
    return new URL(bruto).hostname;
  } catch {
    // APP_URL sem protocolo: aceita assim mesmo
    return bruto.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sessão inválida." }, 401);

    const { data: store } = await supabase
      .from("stores")
      .select(
        "id, stripe_account_id, stripe_charges_enabled, dominio, dominio_status",
      )
      .eq("owner_id", user.id)
      .single();

    if (!store?.stripe_account_id) {
      return json({ error: "Conta de recebimento ainda não criada." }, 400);
    }

    if (!store.stripe_charges_enabled) {
      return json(
        {
          error:
            "Termine a verificação da conta antes de ativar as carteiras digitais.",
        },
        400
      );
    }

    const dominio = dominioDaPlataforma();
    if (!dominio) {
      return json(
        { error: "Domínio da plataforma não configurado no servidor." },
        500
      );
    }

    /*
     * Os dois endereços por onde a loja pode ser aberta.
     *
     * A Stripe exige o registro de TODO domínio que mostra o
     * formulário de pagamento — "This includes registering top-level
     * domains and subdomains". Em cobrança direta, o registro vai na
     * conta do lojista, não na da plataforma: "The domain where the
     * charge is being run needs to be registered for the user
     * running the charge."
     *
     * Sem o domínio próprio registrado aqui, Apple Pay e Google Pay
     * simplesmente não aparecem na loja dele. Sem erro, sem aviso —
     * o botão só não existe, e ninguém descobre por quê.
     *
     * O domínio vem do BANCO, nunca do navegador: quem mandasse o
     * corpo da requisição poderia registrar o domínio de outra
     * pessoa na conta do lojista.
     */
    const dominios = [dominio];
    if (store.dominio && store.dominio_status === "ativo") {
      const proprio = String(store.dominio).trim().toLowerCase();
      if (proprio && proprio !== dominio) dominios.push(proprio);
    }

    const opcoes = { stripeAccount: store.stripe_account_id };

    // Já registrado? A Stripe recusa duplicata, então conferimos antes.
    const existentes = await stripe.paymentMethodDomains.list(
      { limit: 100 },
      opcoes
    );

    let registro: any = null;
    let jaTem: any = null;
    const resultados: {
      dominio: string;
      applePay: string | null;
      googlePay: string | null;
    }[] = [];

    for (const alvo of dominios) {
      const existente = existentes.data.find((d) => d.domain_name === alvo);

      let atual: any = existente;
      if (!atual) {
        atual = await stripe.paymentMethodDomains.create(
          { domain_name: alvo },
          opcoes
        );
      } else if (!atual.enabled) {
        // Existia desativado — reativa em vez de criar outro.
        atual = await stripe.paymentMethodDomains.update(
          atual.id,
          { enabled: true },
          opcoes
        );
      }

      resultados.push({
        dominio: alvo,
        applePay: atual?.apple_pay?.status ?? null,
        googlePay: atual?.google_pay?.status ?? null,
      });

      // O domínio da plataforma é o que a tela já mostrava; mantém
      // a resposta antiga funcionando igual.
      if (alvo === dominio) {
        registro = atual;
        jaTem = existente;
      }
    }

    // A Stripe valida o domínio de forma assíncrona e diz, por
    // carteira, se está tudo certo. Repassamos isso cru para a tela
    // poder explicar o que falta em vez de só dizer "não funcionou".
    const apple = (registro as any).apple_pay;
    const google = (registro as any).google_pay;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await admin
      .from("stores")
      .update({
        stripe_dominio_registrado: dominio,
        stripe_carteiras_ativas:
          apple?.status === "active" || google?.status === "active",
      })
      .eq("id", store.id);

    return json({
      sucesso: true,
      dominio,
      jaExistia: Boolean(jaTem),
      applePay: apple?.status ?? null,
      googlePay: google?.status ?? null,
      // Campo novo: o resultado de cada domínio registrado. Os de
      // cima continuam iguais para a tela atual não quebrar.
      dominios: resultados,
    });
  } catch (err) {
    console.error("Erro ao registrar domínio:", err);
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro ao ativar as carteiras digitais.";
    return json({ error: msg }, 500);
  }
});

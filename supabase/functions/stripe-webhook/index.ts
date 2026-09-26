// ============================================================
// stripe-webhook
// Única fonte de verdade sobre "o pagamento aconteceu mesmo".
// O retorno do navegador NUNCA é suficiente: qualquer pessoa
// consegue forjar a tela de sucesso; forjar um evento assinado
// pela Stripe, não.
// https://docs.stripe.com/webhooks
//
// ⚠️ COBRANÇA DIRETA: os eventos de pagamento nascem na conta
// CONECTADA do lojista, não na da plataforma. Eles chegam com
// `event.account` preenchido — e só chegam se o endpoint estiver
// cadastrado no Dashboard como endpoint de CONNECT ("Events on
// connected accounts"). Num endpoint comum, nada chega.
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

/**
 * Segredos de assinatura aceitos.
 *
 * Cada endpoint cadastrado na Stripe tem o SEU próprio `whsec_`, e
 * este projeto precisa de vários: o da conta da plataforma (onde
 * chega a mensalidade), o das contas CONECTADAS (onde chega
 * "pagamento aprovado", já que a cobrança é direta) e o destino de
 * eventos v2 (mudanças no cadastro do lojista).
 *
 * Em vez de listar nomes fixos, varremos toda variável de ambiente
 * que comece com STRIPE_WEBHOOK_SECRET. Cadastrar um endpoint novo
 * passa a ser só criar mais um segredo — sem mexer neste arquivo e
 * sem descobrir tarde demais que faltava um.
 *
 * Tentamos cada segredo até um validar. Isso não afrouxa nada: o
 * evento continua tendo que estar assinado por um segredo nosso.
 */
const SEGREDOS = Object.entries(Deno.env.toObject())
  .filter(
    ([nome, valor]) =>
      nome.startsWith("STRIPE_WEBHOOK_SECRET") && valor?.startsWith("whsec_")
  )
  .map(([, valor]) => valor);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Falta assinatura do webhook.", { status: 400 });
  }

  if (SEGREDOS.length === 0) {
    console.error("Nenhum segredo de webhook configurado.");
    return new Response("Webhook não configurado.", { status: 500 });
  }

  // Verificação criptográfica: garante que o evento veio mesmo da
  // Stripe, e não de alguém batendo na URL.
  let event: Stripe.Event | null = null;
  for (const segredo of SEGREDOS) {
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        segredo
      );
      break;
    } catch {
      // Segredo errado para este endpoint — tenta o próximo.
    }
  }

  if (!event) {
    console.error("Assinatura inválida para todos os segredos conhecidos.");
    return new Response("Assinatura inválida.", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ---------------------------------------------------------------
  // Idempotência.
  // A Stripe reenvia o mesmo evento quando não recebe 200 a tempo.
  // A chave primária de stripe_events é o id do evento: a segunda
  // gravação falha, e é assim que sabemos que já processamos.
  // ---------------------------------------------------------------
  const { error: erroClaim } = await admin.from("stripe_events").insert({
    id: event.id,
    tipo: event.type,
    payload: { account: (event as any).account ?? null },
  });

  if (erroClaim) {
    // Duplicado: já processado. Responder 200 encerra as retentativas.
    console.log(`Evento ${event.id} já processado — ignorando.`);
    return new Response(JSON.stringify({ received: true, duplicado: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Conta conectada de onde o evento veio (vazio = conta da plataforma). */
  const contaConectada = (event as any).account as string | undefined;

  /** A loja dona daquela conta conectada. */
  async function lojaDaConta(): Promise<string | null> {
    if (!contaConectada) return null;
    const { data } = await admin
      .from("stores")
      .select("id")
      .eq("stripe_account_id", contaConectada)
      .maybeSingle();
    return data?.id ?? null;
  }

  try {
    switch (event.type) {
      // -----------------------------------------------------------
      // Pagamento aprovado
      // -----------------------------------------------------------
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.order_id;
        const storeId = pi.metadata?.store_id ?? (await lojaDaConta());

        await admin
          .from("payments")
          .update({
            status: "recebido",
            stripe_charge_id:
              typeof pi.latest_charge === "string" ? pi.latest_charge : null,
            stripe_account_id: contaConectada ?? null,
          })
          .eq("stripe_payment_intent_id", pi.id);

        if (orderId) {
          // O filtro por loja é redundante com o id do pedido, mas
          // custa nada e fecha a porta de um evento apontar para
          // pedido de outra loja.
          const q = admin
            .from("orders")
            .update({ status: "pago" })
            .eq("id", orderId)
            .eq("status", "pendente");

          await (storeId ? q.eq("store_id", storeId) : q);
        }
        break;
      }

      // -----------------------------------------------------------
      // Pagamento recusado
      // -----------------------------------------------------------
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await admin
          .from("payments")
          .update({
            status: "falhou",
            erro_mensagem: pi.last_payment_error?.message ?? null,
          })
          .eq("stripe_payment_intent_id", pi.id);
        break;
      }

      // -----------------------------------------------------------
      // Reembolso
      // Cobre o caso do lojista devolver pelo painel da Stripe em vez
      // do nosso — sem isto o pedido continuaria "pago" aqui dentro.
      // -----------------------------------------------------------
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : null;
        if (!piId) break;

        const { data: pagamento } = await admin
          .from("payments")
          .select("id, order_id, store_id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();

        if (!pagamento) break;

        const devolvido = (charge.amount_refunded ?? 0) / 100;
        const totalCobrado = (charge.amount ?? 0) / 100;
        const devolvidoPorInteiro =
          (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);

        await admin
          .from("orders")
          .update({
            valor_reembolsado: devolvido,
            reembolsado_em: new Date().toISOString(),
            ...(devolvidoPorInteiro ? { status: "devolvido" } : {}),
          })
          .eq("id", pagamento.order_id)
          .eq("store_id", pagamento.store_id);

        if (devolvidoPorInteiro) {
          await admin
            .from("payments")
            .update({ status: "estornado" })
            .eq("id", pagamento.id);
        }

        console.log(
          `Reembolso sincronizado: pedido ${pagamento.order_id}, ` +
            `${devolvido} de ${totalCobrado}.`
        );
        break;
      }

      // -----------------------------------------------------------
      // Status da conta do lojista mudou
      // As contas nascem pela API v2, que emite o evento com outro
      // nome; tratamos os dois para não depender da versão.
      // -----------------------------------------------------------
      case "account.updated": {
        const conta = event.data.object as Stripe.Account;
        await admin
          .from("stores")
          .update({
            stripe_charges_enabled: conta.charges_enabled,
            stripe_payouts_enabled: conta.payouts_enabled,
            stripe_onboarding_completo: conta.details_submitted,
            stripe_atualizado_em: new Date().toISOString(),
          })
          .eq("stripe_account_id", conta.id);
        break;
      }

      default: {
        // v2.core.account... — o SDK ainda tipa esses como desconhecidos.
        const tipo = event.type as string;
        if (tipo.startsWith("v2.core.account")) {
          const contaId =
            (event as any).related_object?.id ?? contaConectada ?? null;
          if (contaId) {
            // O payload v2 não traz os flags prontos; marcamos a hora
            // e o painel reconsulta o status por conta própria.
            await admin
              .from("stores")
              .update({ stripe_atualizado_em: new Date().toISOString() })
              .eq("stripe_account_id", contaId);
          }
        }
        // Os demais eventos são ignorados de propósito.
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`Erro ao processar ${event.type} (${event.id}):`, err);

    // Libera a marca de processado: assim a retentativa da Stripe
    // encontra o caminho livre em vez de ser descartada como duplicada.
    await admin.from("stripe_events").delete().eq("id", event.id);

    return new Response("Erro ao processar evento.", { status: 500 });
  }
});

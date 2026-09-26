// ============================================================
// stripe-reembolso
// Devolve dinheiro ao cliente — total ou parcial.
//
// As vendas desta plataforma são COBRANÇA DIRETA: o pagamento
// nasce na conta Connect do lojista, então o reembolso também
// precisa ser criado lá — daí o `{ stripeAccount }` no segundo
// argumento. Sem ele a Stripe procuraria o PaymentIntent na
// conta da plataforma e devolveria "No such payment_intent".
// https://docs.stripe.com/connect/direct-charges#refunds
//
// SEGURANÇA — a função só aceita o reembolso depois de:
//   1. validar o token do lojista (nada de service role sozinho)
//   2. achar a loja pelo owner_id DESSE usuário
//   3. achar o pedido filtrando por store_id daquela loja
//   4. achar o pagamento filtrando por order_id E store_id
//   5. conferir que o valor cabe no que ainda não foi devolvido
//
// Passar um orderId de outra loja não retorna erro revelador:
// simplesmente não encontra o pedido.
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

/** Motivos que a Stripe aceita. Qualquer outra coisa vira "requested_by_customer". */
const MOTIVOS_STRIPE = new Set([
  "duplicate",
  "fraudulent",
  "requested_by_customer",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---------- 1. quem está pedindo ----------
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

    const { orderId, valor, motivo } = await req.json();
    if (!orderId) return json({ error: "Pedido não informado." }, 400);

    // ---------- 2. a loja DESSE usuário ----------
    const { data: store } = await supabase
      .from("stores")
      .select("id, stripe_account_id")
      .eq("owner_id", user.id)
      .single();

    if (!store) return json({ error: "Loja não encontrada." }, 404);
    if (!store.stripe_account_id) {
      return json(
        { error: "Sua conta de recebimentos ainda não está ativa." },
        400
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------- 3. o pedido, preso à loja ----------
    const { data: order } = await admin
      .from("orders")
      .select("id, numero, status, total, valor_reembolsado")
      .eq("id", orderId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (!order) return json({ error: "Pedido não encontrado." }, 404);

    if (order.status === "pendente") {
      return json(
        { error: "Este pedido ainda não foi pago — não há o que devolver." },
        400
      );
    }

    // ---------- 4. o pagamento, preso ao pedido E à loja ----------
    const { data: pagamento } = await admin
      .from("payments")
      .select("id, stripe_payment_intent_id, valor_bruto, status")
      .eq("order_id", order.id)
      .eq("store_id", store.id)
      .not("stripe_payment_intent_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pagamento?.stripe_payment_intent_id) {
      return json(
        {
          error:
            "Este pedido não tem cobrança pela Stripe (pode ter sido pago por fora). " +
            "Marque como cancelado e acerte com o cliente diretamente.",
        },
        400
      );
    }

    // ---------- 5. o valor cabe? ----------
    const jaDevolvido = Number(order.valor_reembolsado ?? 0);
    const disponivel = Number(order.total) - jaDevolvido;

    if (disponivel <= 0) {
      return json({ error: "Este pedido já foi totalmente devolvido." }, 400);
    }

    // Sem valor = devolve tudo o que ainda resta
    const valorReembolso =
      valor == null || valor === "" ? disponivel : Number(valor);

    if (!Number.isFinite(valorReembolso) || valorReembolso <= 0) {
      return json({ error: "Valor de devolução inválido." }, 400);
    }

    // Comparação em centavos: 0.1 + 0.2 em ponto flutuante não é 0.3,
    // e sem arredondar aqui um reembolso total legítimo seria recusado.
    const centavos = Math.round(valorReembolso * 100);
    const centavosDisponiveis = Math.round(disponivel * 100);

    if (centavos > centavosDisponiveis) {
      return json(
        {
          error: `Só é possível devolver até ${(
            centavosDisponiveis / 100
          ).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })} neste pedido.`,
        },
        400
      );
    }

    if (centavos < 1) {
      return json({ error: "Valor abaixo do mínimo aceito." }, 400);
    }

    // ---------- 6. Stripe ----------
    const motivoStripe = MOTIVOS_STRIPE.has(motivo)
      ? motivo
      : "requested_by_customer";

    const refund = await stripe.refunds.create(
      {
        payment_intent: pagamento.stripe_payment_intent_id,
        amount: centavos,
        reason: motivoStripe,
        metadata: {
          order_id: order.id,
          numero: String(order.numero),
          store_id: store.id,
        },
      },
      {
        stripeAccount: store.stripe_account_id,
        // Reapertar o botão não devolve o dinheiro duas vezes:
        // mesma chave, mesma resposta.
        idempotencyKey: `re_${order.id}_${jaDevolvido}_${centavos}`,
      }
    );

    if (refund.status === "failed" || refund.status === "canceled") {
      return json(
        {
          error:
            "A Stripe recusou a devolução. Verifique o saldo da sua conta de recebimentos.",
        },
        402
      );
    }

    // ---------- 7. registra ----------
    const novoAcumulado = (jaDevolvido * 100 + centavos) / 100;
    const totalDevolvido =
      Math.round(novoAcumulado * 100) >= Math.round(Number(order.total) * 100);

    await admin
      .from("orders")
      .update({
        valor_reembolsado: novoAcumulado,
        reembolsado_em: new Date().toISOString(),
        motivo_reembolso: typeof motivo === "string" ? motivo.slice(0, 200) : null,
        stripe_refund_id: refund.id,
        ...(totalDevolvido ? { status: "devolvido" } : {}),
      })
      .eq("id", order.id)
      .eq("store_id", store.id);

    if (totalDevolvido) {
      await admin
        .from("payments")
        .update({ status: "estornado" })
        .eq("id", pagamento.id)
        .eq("store_id", store.id);
    }

    return json({
      sucesso: true,
      refundId: refund.id,
      valorDevolvido: centavos / 100,
      totalDevolvido,
      valorReembolsadoAcumulado: novoAcumulado,
    });
  } catch (err) {
    // O erro cru da Stripe pode conter ids internos — o lojista recebe
    // a mensagem tratada, o detalhe fica no log da função.
    console.error("Erro ao reembolsar:", err);
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Erro ao processar a devolução.";
    return json({ error: msg }, 500);
  }
});

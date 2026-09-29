// ============================================================
// stripe-create-payment-intent
// Cria o PaymentIntent do checkout da loja pública.
//
// COBRANÇA DIRETA (direct charge): o pagamento nasce DENTRO da
// conta Connect do lojista — daí o `{ stripeAccount }` no segundo
// argumento. O dinheiro nunca passa pela plataforma, e não há
// application_fee: a plataforma cobra mensalidade, não percentual
// sobre a venda.
// https://docs.stripe.com/connect/direct-charges
//
// Por isso a resposta devolve `stripeAccount` e `publishableKey`:
// o Stripe.js do checkout precisa ser inicializado com a conta do
// lojista, senão o clientSecret é recusado.
// ============================================================
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  dentroDoLimite,
  origemDaChamada,
  respostaLimite,
} from "../_shared/limite.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
});

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface RequestBody {
  storeId: string;
  orderId: string;
  amountInCents: number;
  metodo: "pix" | "card";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, orderId, amountInCents, metodo }: RequestBody =
      await req.json();

    // Esta função responde sem login. Sem limite, dá para encher a
    // conta Stripe do lojista de cobranças abandonadas em laço.
    // Service role aqui porque quem chama é o CLIENTE FINAL — anônimo,
    // sem login, sem sessão para autenticar. A proteção é outra: a loja
    // precisa estar ativa e habilitada, o pedido precisa ser dela, e o
    // valor precisa bater com o total gravado no banco.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!(await dentroDoLimite(admin, `pi:${origemDaChamada(req)}`, 20, 60))) {
      return respostaLimite(corsHeaders);
    }

    if (
      !storeId ||
      !orderId ||
      !amountInCents ||
      amountInCents < 50 ||
      (metodo !== "pix" && metodo !== "card")
    ) {
      return json({ error: "Dados inválidos para criar o pagamento." }, 400);
    }

    const { data: store } = await admin
      .from("stores")
      .select("id, ativo, stripe_account_id, stripe_charges_enabled, aceita_pix, aceita_cartao")
      .eq("id", storeId)
      .maybeSingle();

    if (!store || !store.ativo) {
      return json({ error: "Loja não encontrada ou inativa." }, 404);
    }

    if (!store.stripe_account_id || !store.stripe_charges_enabled) {
      return json(
        { error: "Esta loja ainda não pode receber pagamentos com cartão." },
        400
      );
    }

    // O meio escolhido é oferecido por esta loja?
    // A tela pública já filtra, mas ela é o navegador do cliente —
    // quem decide de verdade é aqui.
    const aceita = metodo === "pix" ? store.aceita_pix : store.aceita_cartao;
    if (!aceita) {
      return json(
        {
          error:
            metodo === "pix"
              ? "Esta loja não está aceitando Pix no momento."
              : "Esta loja não está aceitando cartão no momento.",
        },
        400
      );
    }

    const { data: order } = await admin
      .from("orders")
      .select("id, numero, store_id, total, status")
      .eq("id", orderId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (!order) return json({ error: "Pedido não encontrado." }, 404);

    // Um pedido já pago não gera cobrança nova.
    if (order.status !== "pendente") {
      return json({ error: "Este pedido já foi processado." }, 400);
    }

    // O valor vem do navegador do cliente — quem manda é o banco.
    const totalEmCentavos = Math.round(Number(order.total) * 100);
    if (totalEmCentavos !== amountInCents) {
      return json(
        { error: "Valor do pagamento não confere com o pedido." },
        400
      );
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalEmCentavos,
        currency: "brl",
        // Restringe à forma escolhida na loja (Pix XOR cartão), em vez
        // de mostrar as duas juntas via automatic_payment_methods.
        payment_method_types: [metodo],
        metadata: {
          order_id: order.id,
          store_id: store.id,
          numero: String(order.numero ?? ""),
        },
      },
      {
        stripeAccount: store.stripe_account_id,
        // Recarregar a tela de pagamento não cria uma segunda cobrança:
        // mesma chave, mesmo PaymentIntent de volta.
        idempotencyKey: `pi_${order.id}_${totalEmCentavos}_${metodo}`,
      }
    );

    // upsert e não insert: com a idempotência acima, uma segunda
    // tentativa devolve o MESMO id — um insert quebraria na chave
    // única (store_id, transacao_id).
    //
    // O erro é CONFERIDO e registrado. Antes era ignorado: se a
    // gravação falhasse, a venda seguia (o dinheiro já tinha
    // entrado) mas o pedido ficava sem registro de cobrança, e só
    // aparecia dias depois, na hora de devolver.
    const { error: erroPagamento } = await admin.from("payments").upsert(
      {
        store_id: store.id,
        order_id: order.id,
        transacao_id: paymentIntent.id,
        metodo: metodo === "pix" ? "pix" : "cartao_stripe",
        valor_bruto: order.total,
        taxa: 0,
        valor_liquido: order.total,
        status: "pendente",
        stripe_payment_intent_id: paymentIntent.id,
      },
      { onConflict: "store_id,transacao_id" }
    );

    if (erroPagamento) {
      // Não derruba a venda: o PaymentIntent já existe e o cliente
      // está esperando a tela de pagamento. Mas fica no log, e o
      // webhook conserta quando o pagamento for aprovado.
      console.error(
        `Falha ao gravar payments do pedido ${order.id}:`,
        erroPagamento
      );
    }

    return json({
      clientSecret: paymentIntent.client_secret,
      // A conta do lojista: é o que faz o clientSecret da cobrança
      // direta ser aceito pelo Stripe.js da loja.
      stripeAccount: store.stripe_account_id,
      // Vem do servidor para o .env do front nunca ficar defasado.
      publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "",
    });
  } catch (err) {
    console.error("Erro ao criar PaymentIntent:", err);

    const bruto =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";

    // A Stripe recusa o meio quando ele não está ativado na conta.
    // A mensagem dela vem em inglês e com link do painel dela — o
    // cliente final da loja não pode ver isso. Traduzimos para algo
    // que faça sentido para quem está comprando, e o detalhe técnico
    // fica no log, para o lojista.
    if (
      /payment method type/i.test(bruto) &&
      /invalid|not activated|activated/i.test(bruto)
    ) {
      return json(
        {
          error:
            "Esta forma de pagamento ainda não está liberada nesta loja. " +
            "Escolha outra forma ou fale com a loja.",
          codigo: "meio_nao_ativado",
        },
        400
      );
    }

    // Quem chama esta função é o CLIENTE FINAL, sem login. Mensagem
    // crua da Stripe aqui entrega id de conta conectada, nome de campo
    // e detalhe de configuração para qualquer pessoa. O detalhe fica
    // no log; o comprador vê uma frase que dá para entender.
    console.error("stripe-create-payment-intent:", bruto);
    return json(
      { error: "Não foi possível iniciar o pagamento. Tente de novo." },
      500
    );
  }
});

import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Pede a capacidade de Pix para a conta do lojista.
 *
 * ----------------------------------------------------------------
 * Por que é uma função separada
 * ----------------------------------------------------------------
 * A tentação seria pôr `pix_payments` junto de `card_payments` na
 * criação da conta. Não dá: se a Stripe recusar a capacidade, ela
 * recusa a CHAMADA INTEIRA — e a criação de conta pararia de
 * funcionar. O Pix derrubaria o cartão.
 *
 * Aqui o pedido acontece depois, sozinho, na sua própria chamada.
 * Se falhar, falha só o Pix: cartão, cadastro, repasses e painéis
 * seguem exatamente como estão.
 *
 * ----------------------------------------------------------------
 * Duas vias, porque a documentação é ambígua
 * ----------------------------------------------------------------
 * A tabela de capacidades da Stripe marca Pix como "Accounts v2
 * support: No". Mas as contas desta plataforma, apesar de criadas
 * por /v2/core/accounts, respondem a endpoints v1 — a própria função
 * de criar conta usa /v1/accounts/{id}/external_accounts para a conta
 * bancária, e funciona.
 *
 * Então "No" pode significar duas coisas diferentes: que a capacidade
 * não é expressável no objeto de configuração da v2, ou que ela é
 * impossível nessa conta. São coisas distintas, e esta função
 * descobre qual é:
 *
 *   1. tenta pela v2 (o mesmo caminho do card_payments);
 *   2. se a v2 recusar, tenta pela API de capacidades da v1;
 *   3. devolve qual via funcionou, ou as duas mensagens de erro.
 *
 * ----------------------------------------------------------------
 * ATENÇÃO: pedir capacidade não é reversível
 * ----------------------------------------------------------------
 * A documentação diz: "For some capabilities, requesting them enables
 * them permanently. Attempting to remove or unrequest a permanent
 * capability returns an error." E pedir dispara account.updated, o que
 * pode criar exigências novas na conta.
 *
 * Por isso esta função NÃO é chamada sozinha em lugar nenhum. Ela
 * responde a uma ação explícita do lojista, e o modo `apenas_conferir`
 * existe para olhar antes de pedir, sem alterar nada.
 */

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const VERSAO_V2 = "2026-08-26.preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Lê a capacidade sem alterar nada. */
async function lerCapacidadeV1(contaId: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/accounts/${contaId}/capabilities/pix_payments`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
  );
  const dados = await res.json();
  return { ok: res.ok, status: res.status, dados };
}

async function pedirPelaV2(contaId: string) {
  const res = await fetch(
    `https://api.stripe.com/v2/core/accounts/${contaId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/json",
        "Stripe-Version": VERSAO_V2,
      },
      body: JSON.stringify({
        configuration: {
          merchant: { capabilities: { pix_payments: { requested: true } } },
        },
        include: ["configuration.merchant"],
      }),
    },
  );
  const dados = await res.json();
  return { ok: res.ok, dados };
}

async function pedirPelaV1(contaId: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/accounts/${contaId}/capabilities/pix_payments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "requested=true",
    },
  );
  const dados = await res.json();
  return { ok: res.ok, dados };
}

function mensagemDeErro(d: any) {
  return d?.error?.message ?? d?.message ?? "Erro desconhecido da Stripe.";
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
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Sessão inválida." }, 401);

    const { data: store } = await supabase
      .from("stores")
      .select("id, stripe_account_id, stripe_charges_enabled")
      .eq("owner_id", user.id)
      .single();

    if (!store?.stripe_account_id) {
      return json({ error: "Conta de recebimento ainda não criada." }, 400);
    }

    // Pedir capacidade antes da conta estar verificada só cria
    // exigência em cima de exigência e confunde o lojista.
    if (!store.stripe_charges_enabled) {
      return json(
        {
          error:
            "Termine a verificação da conta de recebimento antes de ativar o Pix.",
        },
        400,
      );
    }

    const contaId = store.stripe_account_id as string;

    // ---- Passo 1: olhar, sempre ---------------------------------
    const leitura = await lerCapacidadeV1(contaId);

    let corpo: any = null;
    try {
      corpo = await req.json();
    } catch {
      corpo = {};
    }

    if (corpo?.apenas_conferir === true) {
      return json({
        apenasConferiu: true,
        capacidadeExiste: leitura.ok,
        status: leitura.ok ? leitura.dados?.status : null,
        requisitos: leitura.ok ? leitura.dados?.requirements : null,
        detalhe: leitura.ok ? null : mensagemDeErro(leitura.dados),
      });
    }

    // Já ativa: nada a fazer, e dizer isso é melhor do que pedir de novo.
    if (leitura.ok && leitura.dados?.status === "active") {
      return json({ sucesso: true, via: "ja_estava_ativa", status: "active" });
    }

    // ---- Passo 2: pedir, primeiro pela v2 -----------------------
    const v2 = await pedirPelaV2(contaId);
    if (v2.ok) {
      const depois = await lerCapacidadeV1(contaId);
      return json({
        sucesso: true,
        via: "v2",
        status: depois.ok ? depois.dados?.status : "requested",
        requisitos: depois.ok ? depois.dados?.requirements : null,
      });
    }

    // ---- Passo 3: a v2 recusou, tentar pela v1 ------------------
    const v1 = await pedirPelaV1(contaId);
    if (v1.ok) {
      return json({
        sucesso: true,
        via: "v1",
        status: v1.dados?.status ?? "requested",
        requisitos: v1.dados?.requirements ?? null,
        // Guardado de propósito: se a v2 recusou e a v1 aceitou, essa
        // é a informação que responde a dúvida aberta com o suporte.
        v2Recusou: mensagemDeErro(v2.dados),
      });
    }

    // ---- As duas recusaram: aí é limitação real -----------------
    return json(
      {
        error:
          "O provedor de pagamento não permite ativar o Pix nesta conta.",
        // Mensagens cruas para o diagnóstico, não para a tela do lojista.
        detalheV2: mensagemDeErro(v2.dados),
        detalheV1: mensagemDeErro(v1.dados),
      },
      400,
    );
  } catch (err) {
    console.error("Erro ao ativar Pix:", err);
    return json({ error: "Erro ao ativar o Pix." }, 500);
  }
});

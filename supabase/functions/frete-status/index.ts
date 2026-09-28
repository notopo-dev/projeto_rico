// ============================================================
// frete-status
//
// Testa a conexão da loja com o Melhor Envio e devolve o estado
// da conta: nome, e-mail e saldo.
//
// Por que existe: antes, a única forma de descobrir que o token
// estava errado era um CLIENTE chegar no checkout, digitar o CEP e
// ver "não foi possível calcular o frete". O lojista nunca ficava
// sabendo. Aqui ele aperta um botão e a resposta é imediata.
//
// O erro mais comum não é token inválido — é token de PRODUÇÃO
// batendo no ambiente de teste (ou o contrário). Os dois devolvem
// 401 e parecem a mesma coisa, então esta função explica a
// diferença em vez de repassar "Unauthenticated".
//
// Quem chama é o LOJISTA logado. Usa a chave anônima com o
// Authorization dele, então o RLS é quem decide o que ele lê —
// a função não tem poder de ver a loja de outra pessoa.
//
// https://docs.melhorenvio.com.br/
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: JSON_HEADERS });
}

function baseDoAmbiente(ambiente: string | null) {
  return ambiente === "producao"
    ? "https://melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return responder({ error: "Não autenticado." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return responder({ error: "Sessão expirada. Entre de novo." }, 401);
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id, email, cep_origem")
      .eq("owner_id", user.id)
      .single();

    if (!store) {
      return responder({ error: "Loja não encontrada." }, 404);
    }

    const { data: settings } = await supabase
      .from("store_settings")
      .select("melhor_envio_token, melhor_envio_ambiente")
      .eq("store_id", store.id)
      .maybeSingle();

    const ambiente =
      settings?.melhor_envio_ambiente === "producao" ? "producao" : "sandbox";

    if (!settings?.melhor_envio_token) {
      return responder({
        conectado: false,
        ambiente,
        motivo: "sem_token",
        mensagem: "Cole o token do Melhor Envio e salve antes de testar.",
      });
    }

    const base = baseDoAmbiente(ambiente);

    // O Melhor Envio exige um User-Agent com contato de verdade; sem
    // ele a API responde 403 sem explicar. Usa o e-mail da loja quando
    // existe, que é o contato que eles conseguem procurar de fato.
    const contato = store.email || "contato@moneynotopo.com.br";
    const cabecalhos = {
      Authorization: `Bearer ${settings.melhor_envio_token}`,
      Accept: "application/json",
      "User-Agent": `LojaPro (${contato})`,
    };

    const resposta = await fetch(`${base}/api/v2/me`, { headers: cabecalhos });

    if (resposta.status === 401 || resposta.status === 403) {
      const oposto = ambiente === "producao" ? "Teste" : "Produção";
      return responder({
        conectado: false,
        ambiente,
        motivo: "token_recusado",
        mensagem:
          `O Melhor Envio recusou este token no ambiente de ` +
          `${ambiente === "producao" ? "Produção" : "Teste"}. ` +
          `Quase sempre é token de um ambiente usado no outro — ` +
          `tente mudar para ${oposto}, ou gere um token novo no painel do Melhor Envio.`,
      });
    }

    if (!resposta.ok) {
      return responder({
        conectado: false,
        ambiente,
        motivo: "indisponivel",
        mensagem: `O Melhor Envio respondeu com erro ${resposta.status}. Tente de novo em alguns minutos.`,
      });
    }

    const conta = await resposta.json();

    // Saldo é um "seria bom ter": etiqueta é paga com ele, então
    // mostrar zero evita a surpresa na hora de imprimir. Se a consulta
    // falhar, o teste de conexão continua valendo.
    let saldo: number | null = null;
    try {
      const resSaldo = await fetch(`${base}/api/v2/me/balance`, {
        headers: cabecalhos,
      });
      if (resSaldo.ok) {
        const dados = await resSaldo.json();
        const bruto = Number(dados?.balance);
        if (Number.isFinite(bruto)) saldo = bruto;
      }
    } catch {
      // segue sem saldo
    }

    const nome = [conta?.firstname, conta?.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();

    return responder({
      conectado: true,
      ambiente,
      nome: nome || conta?.email || "Conta conectada",
      email: conta?.email ?? null,
      saldo,
      temCepOrigem: Boolean(store.cep_origem),
    });
  } catch (err) {
    console.error("frete-status:", err);
    return responder(
      { error: err instanceof Error ? err.message : "Erro desconhecido." },
      500,
    );
  }
});

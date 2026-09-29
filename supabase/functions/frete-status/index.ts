// ============================================================
// frete-status
//
// Diz se a loja está de fato conectada no Melhor Envio, e mostra a
// conta e o saldo.
//
// Por que existe: antes, a única forma de descobrir que a conexão
// estava quebrada era um CLIENTE chegar no checkout, digitar o CEP e
// ver "não foi possível calcular o frete". O lojista nunca ficava
// sabendo. Aqui ele aperta um botão e a resposta é imediata.
//
// Não guarda token nem renova nada por conta própria: pede o acesso ao
// helper, que é quem cuida da validade dos 30 dias. Assim o teste
// exercita exatamente o mesmo caminho que o checkout vai usar — um
// teste que passa por outro caminho não prova nada.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  cabecalhosME,
  ErroMelhorEnvio,
  obterAcesso,
} from "../_shared/melhorEnvio.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: JSON_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return responder({ error: "Não autenticado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return responder({ error: "Sessão expirada. Entre de novo." }, 401);

    const { data: store } = await supabase
      .from("stores")
      .select("id, email, cep_origem")
      .eq("owner_id", user.id)
      .single();
    if (!store) return responder({ error: "Loja não encontrada." }, 404);

    const { data: settings } = await supabase
      .from("store_settings")
      .select("melhor_envio_ambiente, melhor_envio_conta, melhor_envio_expira_em")
      .eq("store_id", store.id)
      .maybeSingle();

    const ambiente =
      settings?.melhor_envio_ambiente === "producao" ? "producao" : "sandbox";

    // O RLS deixa o lojista gravar na própria linha, então o helper
    // consegue renovar o token com este mesmo cliente — sem precisar de
    // service role para um botão de teste.
    let acesso;
    try {
      acesso = await obterAcesso(supabase, store.id);
    } catch (err) {
      if (err instanceof ErroMelhorEnvio) {
        return responder({
          conectado: false,
          ambiente,
          precisaConectar: err.precisaReconectar,
          mensagem: err.message,
        });
      }
      throw err;
    }

    const cabecalhos = cabecalhosME(acesso.token, store.email);
    const resposta = await fetch(`${acesso.base}/api/v2/me`, {
      headers: cabecalhos,
    });

    if (resposta.status === 401 || resposta.status === 403) {
      return responder({
        conectado: false,
        ambiente,
        precisaConectar: true,
        mensagem:
          "O Melhor Envio recusou o acesso. Clique em Conectar para autorizar de novo.",
      });
    }

    if (!resposta.ok) {
      return responder({
        conectado: false,
        ambiente,
        precisaConectar: false,
        mensagem: `O Melhor Envio respondeu com erro ${resposta.status}. Tente de novo em alguns minutos.`,
      });
    }

    const conta = await resposta.json();

    // Saldo é um "seria bom saber": a etiqueta é paga com ele, então
    // ver zero antes evita a surpresa na hora de imprimir. Se a
    // consulta falhar, a conexão continua valendo.
    let saldo: number | null = null;
    try {
      const resSaldo = await fetch(`${acesso.base}/api/v2/me/balance`, {
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

    const nome =
      [conta?.firstname, conta?.lastname].filter(Boolean).join(" ").trim() ||
      settings?.melhor_envio_conta ||
      conta?.email ||
      "Conta conectada";

    return responder({
      conectado: true,
      ambiente,
      nome,
      email: conta?.email ?? null,
      saldo,
      temCepOrigem: Boolean(store.cep_origem),
      expiraEm: settings?.melhor_envio_expira_em ?? null,
    });
  } catch (err) {
    console.error("frete-status:", err);
    return responder(
      { error: err instanceof Error ? err.message : "Erro desconhecido." },
      500,
    );
  }
});

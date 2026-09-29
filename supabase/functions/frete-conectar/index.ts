// ============================================================
// frete-conectar
//
// Liga a conta do lojista no Melhor Envio, via OAuth 2.0.
//
// O Melhor Envio tirou os tokens pessoais do painel — hoje não existe
// nada para o lojista copiar e colar. Ele autoriza a Money NoTopo numa
// tela do Melhor Envio e o token vem para cá.
//
// São dois momentos:
//
//   iniciar   devolve a URL para onde mandar o lojista
//   concluir  recebe o código da volta e troca por token
//
// Quem chama é o LOJISTA logado, com a chave anônima e o Authorization
// dele: é o RLS que decide em qual loja pode gravar, não esta função.
// O client_secret fica só aqui no servidor — é ele que autoriza gastar
// o saldo da conta do lojista.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  baseDoAmbiente,
  credenciaisApp,
  ErroMelhorEnvio,
  pedirTokens,
  type Ambiente,
} from "../_shared/melhorEnvio.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: JSON_HEADERS });
}

/**
 * Só o que as quatro funções de frete realmente usam.
 *
 * Pedir permissão de sobra é pedir para o lojista desconfiar na hora
 * de autorizar — e dar à plataforma poder que ela não precisa ter.
 */
const SCOPES = [
  "shipping-calculate",
  "shipping-companies",
  "cart-read",
  "cart-write",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-tracking",
  "shipping-cancel",
  "orders-read",
  "users-read",
].join(" ");

/** O state vale pouco tempo de propósito: é prova de vida, não sessão. */
const VALIDADE_STATE_MS = 10 * 60 * 1000;

function urlDeRetorno() {
  // Vem do servidor, nunca do navegador. Se o site mandasse o seu
  // próprio redirect_uri, bastaria abrir o checkout de uma página
  // qualquer para desviar o código de autorização para fora.
  const base = (Deno.env.get("APP_URL") ?? "https://moneynotopo.com.br")
    .replace(/\/+$/, "");
  return `${base}/frete`;
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
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!store) return responder({ error: "Loja não encontrada." }, 404);

    const corpo = await req.json().catch(() => ({}));
    const acao = corpo?.acao;

    const { data: settings } = await supabase
      .from("store_settings")
      .select("melhor_envio_ambiente, melhor_envio_state, melhor_envio_state_em")
      .eq("store_id", store.id)
      .maybeSingle();

    const ambiente: Ambiente =
      settings?.melhor_envio_ambiente === "producao" ? "producao" : "sandbox";

    // ----------------------------------------------------------
    // iniciar: monta a URL de autorização
    // ----------------------------------------------------------
    if (acao === "iniciar") {
      const { clientId } = credenciaisApp(ambiente);

      const state = crypto.randomUUID();

      const { error: erroState } = await supabase
        .from("store_settings")
        .update({
          melhor_envio_state: state,
          melhor_envio_state_em: new Date().toISOString(),
        })
        .eq("store_id", store.id);

      if (erroState) throw erroState;

      const url = new URL(`${baseDoAmbiente(ambiente)}/oauth/authorize`);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", urlDeRetorno());
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      url.searchParams.set("scope", SCOPES);

      return responder({ url: url.toString(), ambiente });
    }

    // ----------------------------------------------------------
    // concluir: troca o código pelo token
    // ----------------------------------------------------------
    if (acao === "concluir") {
      const { code, state } = corpo ?? {};

      if (!code || !state) {
        return responder({ error: "Autorização incompleta. Tente conectar de novo." }, 400);
      }

      // Confere que este código pertence à conexão que ESTA loja
      // começou. Sem isso, um link montado por outra pessoa poderia
      // grudar a conta do Melhor Envio dela na loja de alguém — e as
      // etiquetas do lojista passariam a sair do saldo, e do endereço,
      // de um estranho.
      const guardado = settings?.melhor_envio_state;
      const quando = settings?.melhor_envio_state_em
        ? new Date(settings.melhor_envio_state_em).getTime()
        : 0;

      if (!guardado || guardado !== state) {
        return responder(
          { error: "Não foi possível confirmar esta autorização. Conecte de novo pelo botão." },
          400,
        );
      }

      if (Date.now() - quando > VALIDADE_STATE_MS) {
        return responder(
          { error: "A autorização demorou demais e expirou. Conecte de novo." },
          400,
        );
      }

      const tokens = await pedirTokens(ambiente, {
        grant_type: "authorization_code",
        redirect_uri: urlDeRetorno(),
        code,
      });

      // Quem autorizou, para a tela dizer qual conta está ligada. Se
      // falhar, a conexão vale do mesmo jeito — é só um rótulo.
      let conta: string | null = null;
      try {
        const res = await fetch(`${baseDoAmbiente(ambiente)}/api/v2/me`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/json",
            "User-Agent": "LojaPro (contato@moneynotopo.com.br)",
          },
        });
        if (res.ok) {
          const me = await res.json();
          conta =
            [me?.firstname, me?.lastname].filter(Boolean).join(" ").trim() ||
            me?.email ||
            null;
        }
      } catch {
        // segue sem o nome
      }

      const { error: erroGravar } = await supabase
        .from("store_settings")
        .update({
          melhor_envio_token: tokens.access_token,
          melhor_envio_refresh_token: tokens.refresh_token,
          melhor_envio_expira_em: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
          melhor_envio_conta: conta,
          // O state já cumpriu o papel. Guardado, viraria chave velha
          // esperando para ser reaproveitada.
          melhor_envio_state: null,
          melhor_envio_state_em: null,
        })
        .eq("store_id", store.id);

      if (erroGravar) throw erroGravar;

      return responder({ conectado: true, ambiente, conta });
    }

    // ----------------------------------------------------------
    // desconectar
    // ----------------------------------------------------------
    if (acao === "desconectar") {
      const { error } = await supabase
        .from("store_settings")
        .update({
          melhor_envio_token: null,
          melhor_envio_refresh_token: null,
          melhor_envio_expira_em: null,
          melhor_envio_conta: null,
          melhor_envio_state: null,
          melhor_envio_state_em: null,
        })
        .eq("store_id", store.id);

      if (error) throw error;
      return responder({ conectado: false });
    }

    return responder({ error: "Ação desconhecida." }, 400);
  } catch (err) {
    console.error("frete-conectar:", err);
    const mensagem =
      err instanceof ErroMelhorEnvio || err instanceof Error
        ? err.message
        : "Erro desconhecido.";
    return responder({ error: mensagem }, 500);
  }
});

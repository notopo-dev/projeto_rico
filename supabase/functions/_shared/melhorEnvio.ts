// ============================================================
// _shared/melhorEnvio.ts
//
// Tudo que fala com o Melhor Envio passa por aqui.
//
// Existe por causa de um detalhe que quebra integração calada: o
// access_token deles vale 30 dias e o refresh_token vale 45. Quem
// guarda o token e esquece disso descobre em um mês, quando um cliente
// não consegue fechar a compra e ninguém sabe por quê.
//
// Então a regra é: nenhuma função chama a API do Melhor Envio direto.
// Todas pedem o token aqui, e aqui ele é renovado antes de vencer.
// Um lugar só para acertar, em vez de quatro para esquecer.
// ============================================================

export type Ambiente = "sandbox" | "producao";

/** Renova quando falta isto ou menos para vencer. */
const MARGEM_MS = 3 * 24 * 60 * 60 * 1000;

export class ErroMelhorEnvio extends Error {
  /** true quando só o lojista resolve (reconectar na tela de Frete). */
  readonly precisaReconectar: boolean;

  constructor(mensagem: string, precisaReconectar = false) {
    super(mensagem);
    this.name = "ErroMelhorEnvio";
    this.precisaReconectar = precisaReconectar;
  }
}

export function baseDoAmbiente(ambiente: Ambiente) {
  return ambiente === "producao"
    ? "https://melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";
}

/**
 * As credenciais do APLICATIVO (não da loja).
 *
 * São da plataforma, uma por ambiente, e vivem só nos secrets das Edge
 * Functions. É o client_secret que autoriza gastar o saldo do lojista,
 * então ele nunca sai do servidor.
 */
export function credenciaisApp(ambiente: Ambiente) {
  const sufixo = ambiente === "producao" ? "" : "_SANDBOX";
  const clientId = Deno.env.get(`MELHOR_ENVIO_CLIENT_ID${sufixo}`);
  const clientSecret = Deno.env.get(`MELHOR_ENVIO_CLIENT_SECRET${sufixo}`);

  if (!clientId || !clientSecret) {
    throw new ErroMelhorEnvio(
      ambiente === "producao"
        ? "O Melhor Envio não está configurado no servidor. Faltam as credenciais do aplicativo."
        : "O ambiente de teste do Melhor Envio não está configurado no servidor.",
    );
  }

  return { clientId, clientSecret };
}

/**
 * O Melhor Envio responde 403 sem User-Agent com contato de verdade,
 * e não explica o motivo. Passar o e-mail da loja quando existe é o
 * que eles pedem na documentação.
 */
export function cabecalhosME(token: string, contato?: string | null) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": `LojaPro (${contato || "contato@moneynotopo.com.br"})`,
  };
}

export interface TokensME {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Troca um código de autorização, ou um refresh_token, por tokens novos. */
export async function pedirTokens(
  ambiente: Ambiente,
  corpo: Record<string, string>,
): Promise<TokensME> {
  const { clientId, clientSecret } = credenciaisApp(ambiente);

  const res = await fetch(`${baseDoAmbiente(ambiente)}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "LojaPro (contato@moneynotopo.com.br)",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      ...corpo,
    }),
  });

  const dados = await res.json().catch(() => null);

  if (!res.ok || !dados?.access_token) {
    const detalhe =
      dados?.error_description ?? dados?.message ?? dados?.error ?? "";
    throw new ErroMelhorEnvio(
      `O Melhor Envio recusou a autorização${detalhe ? `: ${detalhe}` : "."}`,
      true,
    );
  }

  return dados as TokensME;
}

interface LinhaSettings {
  melhor_envio_token: string | null;
  melhor_envio_refresh_token: string | null;
  melhor_envio_expira_em: string | null;
  melhor_envio_ambiente: string | null;
}

export interface AcessoME {
  token: string;
  base: string;
  ambiente: Ambiente;
}

/**
 * Devolve um token VÁLIDO da loja, renovando se estiver perto de
 * vencer. É por aqui que toda chamada à API do Melhor Envio começa.
 *
 * `cliente` precisa poder gravar em store_settings — na prática é o
 * cliente de service role, porque isto também roda em chamada de
 * cliente final (cálculo de frete no checkout), onde não há login.
 */
export async function obterAcesso(
  cliente: any,
  storeId: string,
): Promise<AcessoME> {
  const { data } = await cliente
    .from("store_settings")
    .select(
      "melhor_envio_token, melhor_envio_refresh_token, melhor_envio_expira_em, melhor_envio_ambiente",
    )
    .eq("store_id", storeId)
    .maybeSingle();

  const s = data as LinhaSettings | null;
  const ambiente: Ambiente =
    s?.melhor_envio_ambiente === "producao" ? "producao" : "sandbox";
  const base = baseDoAmbiente(ambiente);

  if (!s?.melhor_envio_token) {
    throw new ErroMelhorEnvio(
      "A loja ainda não conectou o Melhor Envio.",
      true,
    );
  }

  const venceEm = s.melhor_envio_expira_em
    ? new Date(s.melhor_envio_expira_em).getTime()
    : 0;

  // Ainda tem folga: usa o que está guardado.
  if (venceEm - Date.now() > MARGEM_MS) {
    return { token: s.melhor_envio_token, base, ambiente };
  }

  // Sem refresh_token não há o que renovar. Acontece com quem conectou
  // antes desta versão, ou se a autorização foi revogada do lado deles.
  if (!s.melhor_envio_refresh_token) {
    throw new ErroMelhorEnvio(
      "A conexão com o Melhor Envio venceu. Reconecte na tela de Frete.",
      true,
    );
  }

  let novos: TokensME;
  try {
    novos = await pedirTokens(ambiente, {
      grant_type: "refresh_token",
      refresh_token: s.melhor_envio_refresh_token,
    });
  } catch (err) {
    // Passou dos 45 dias, ou o lojista revogou o acesso. Apaga o que
    // não vale mais: token morto guardado só faz a tela mentir que
    // está conectada.
    await cliente
      .from("store_settings")
      .update({
        melhor_envio_token: null,
        melhor_envio_refresh_token: null,
        melhor_envio_expira_em: null,
      })
      .eq("store_id", storeId);

    throw new ErroMelhorEnvio(
      "A conexão com o Melhor Envio expirou. O lojista precisa reconectar na tela de Frete.",
      true,
    );
  }

  await cliente
    .from("store_settings")
    .update({
      melhor_envio_token: novos.access_token,
      melhor_envio_refresh_token: novos.refresh_token,
      melhor_envio_expira_em: new Date(
        Date.now() + novos.expires_in * 1000,
      ).toISOString(),
    })
    .eq("store_id", storeId);

  return { token: novos.access_token, base, ambiente };
}

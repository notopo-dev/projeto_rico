import { supabase } from "./supabaseClient";

/**
 * Links de e-mail que apontam para o nosso domínio.
 *
 * Os modelos do Supabase vinham com {{ .ConfirmationURL }}, que é um
 * endereço supabase.co e aparecia inteiro no corpo da mensagem — o
 * lojista via de onde vem a autenticação da plataforma.
 *
 * Agora o modelo monta o link com {{ .TokenHash }} apontando para
 * moneynotopo.com.br, e é a nossa página que troca o token por sessão.
 * A troca é um POST direto ao /verify do Supabase: não depende do
 * verificador PKCE guardado no navegador, então o link funciona mesmo
 * aberto em outro aparelho — o celular de quem leu o e-mail, por
 * exemplo.
 */

/** Só estes. Um tipo solto deixaria uma tela confirmar o que não é dela. */
export type TipoDeLink = "recovery" | "signup" | "email_change";

export function tokenDoLink(busca: string): string | null {
  const t = new URLSearchParams(busca).get("token_hash");
  return t && t.trim() ? t : null;
}

export function tipoDoLink<T extends TipoDeLink>(
  busca: string,
  permitidos: readonly T[]
): T | null {
  const t = new URLSearchParams(busca).get("type");
  return permitidos.includes(t as T) ? (t as T) : null;
}

export interface ResultadoDaTroca {
  /** Houve sessão: o link valia e já estamos autenticados. */
  autenticado: boolean;
  /**
   * O Supabase aceitou o token mas não devolveu sessão. Acontece na
   * troca de e-mail quando o Supabase pede confirmação nos DOIS
   * endereços e só um foi aberto até agora.
   */
  faltaOutroLado: boolean;
  invalido: boolean;
}

export async function trocarTokenPorSessao(
  token_hash: string,
  type: TipoDeLink
): Promise<ResultadoDaTroca> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return { autenticado: false, faltaOutroLado: false, invalido: true };
    if (data?.session) return { autenticado: true, faltaOutroLado: false, invalido: false };
    return { autenticado: false, faltaOutroLado: true, invalido: false };
  } catch {
    return { autenticado: false, faltaOutroLado: false, invalido: true };
  }
}

/**
 * Tira o token da barra de endereço e do histórico.
 *
 * Ele é de uso único, mas ficaria visível numa captura de tela e iria
 * embora no cabeçalho Referer da primeira imagem externa que a página
 * carregasse.
 */
export function limparUrl(): void {
  window.history.replaceState({}, "", window.location.pathname);
}

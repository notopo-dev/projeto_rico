import { supabase } from "./supabaseClient";

/**
 * store_id da loja do usuário logado.
 *
 * ----------------------------------------------------------------
 * Por que existe cache aqui
 * ----------------------------------------------------------------
 * Esta função é chamada por praticamente toda função de API do painel
 * (21 lugares). A versão anterior fazia DUAS viagens de rede a cada
 * chamada:
 *
 *   1. supabase.auth.getUser()  → bate no servidor de auth para
 *      validar o token (200-500ms)
 *   2. select em `stores`       → mais uma ida ao banco
 *
 * Como toda tela chama isso ANTES da consulta que interessa, cada
 * carregamento ficava com três requisições em série. Abrir Produtos
 * custava getUser + stores + products, uma esperando a outra.
 *
 * Duas mudanças resolvem:
 *
 *   - getSession() no lugar de getUser(): a sessão já está no
 *     navegador, então é leitura local, sem rede. O token continua
 *     sendo validado pelo servidor em toda consulta seguinte, e o
 *     RLS é quem garante o isolamento entre lojas — não esta função.
 *
 *   - cache em memória: o sistema é uma loja por usuário e isso não
 *     muda no meio da sessão. Buscamos uma vez e reaproveitamos.
 *
 * O cache é limpo quando o usuário troca (login, logout, refresh de
 * token com usuário diferente), então não há risco de uma conta ver
 * dados de outra.
 * ----------------------------------------------------------------
 */

let cacheStoreId: string | null = null;
let cacheUserId: string | null = null;
/** Evita disparar várias buscas iguais quando a tela chama em paralelo. */
let buscaEmAndamento: Promise<string> | null = null;

/** Zera o cache. Chamado na troca de usuário. */
export function limparCacheLoja() {
  cacheStoreId = null;
  cacheUserId = null;
  buscaEmAndamento = null;
}

// Uma loja nova pode ser criada logo após o cadastro (trigger no banco),
// então o cache precisa cair quando a sessão muda.
supabase.auth.onAuthStateChange((evento, sessao) => {
  const idAgora = sessao?.user?.id ?? null;

  if (evento === "SIGNED_OUT" || idAgora !== cacheUserId) {
    limparCacheLoja();
  }
});

export async function getCurrentStoreId(): Promise<string> {
  // Já temos, e é do mesmo usuário: devolve na hora.
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    limparCacheLoja();
    throw new Error("Usuário não autenticado.");
  }

  if (cacheStoreId && cacheUserId === user.id) {
    return cacheStoreId;
  }

  // Outra chamada já está buscando: espera a mesma promessa em vez de
  // abrir uma segunda consulta idêntica.
  if (buscaEmAndamento) return buscaEmAndamento;

  buscaEmAndamento = (async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (error || !data) {
      buscaEmAndamento = null;
      throw new Error("Loja não encontrada para este usuário.");
    }

    cacheStoreId = data.id;
    cacheUserId = user.id;
    buscaEmAndamento = null;
    return data.id;
  })();

  return buscaEmAndamento;
}

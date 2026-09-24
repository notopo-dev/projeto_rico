import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas."
  );
}

/**
 * Cliente ÚNICO do Supabase para todo o app.
 *
 * Existe só um por design: dois clientes na mesma página disputam
 * a mesma chave de sessão e causam comportamento imprevisível
 * (era a origem do aviso "Multiple GoTrueClient instances").
 *
 * Segurança:
 * - flowType "pkce": o fluxo recomendado para apps que rodam no
 *   navegador. O token só é trocado por quem iniciou o login,
 *   o que protege contra interceptação do código de autorização.
 * - autoRefreshToken: renova a sessão antes de expirar, então dá
 *   para manter expiração curta do access token sem derrubar o
 *   usuário no meio do uso.
 * - A senha nunca passa por aqui em texto guardado: o Supabase
 *   faz o hash (bcrypt) no servidor e só devolve tokens.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "lojapro-auth",
  },
});
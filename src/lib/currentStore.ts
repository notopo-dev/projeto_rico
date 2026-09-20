import { supabase } from "./supabaseClient";

/**
 * Retorna o store_id da loja do usuário logado.
 * Como o sistema é 1 loja por usuário, sempre existe no máximo
 * uma linha em `stores` com owner_id = usuário atual.
 */
export async function getCurrentStoreId(): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", userData.user.id)
    .single();

  if (error || !data) {
    throw new Error("Loja não encontrada para este usuário.");
  }

  return data.id;
}
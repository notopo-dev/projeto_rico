import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Configurações da conta do lojista.
 *
 * As notificações por e-mail moravam aqui e saíram: elas gravavam a
 * preferência no banco e nada no projeto lia esse valor nem enviava
 * e-mail nenhum. Um interruptor que promete aviso de venda e não
 * avisa é pior do que a ausência dele — o lojista confia e perde a
 * venda em silêncio.
 *
 * As colunas notif_* continuam no banco, intactas. Quando existir um
 * remetente de verdade, a tela volta — com os eventos que de fato
 * disparam, e só eles.
 */

export interface DadosConta {
  nome: string;
  email: string;
}

/**
 * Busca os dados da conta do usuário logado (perfil + email
 * do Supabase Auth).
 */
export async function getDadosConta(): Promise<DadosConta> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", userData.user.id)
    .maybeSingle();

  return {
    nome: profile?.nome ?? "",
    email: userData.user.email ?? "",
  };
}

/**
 * Atualiza o nome do perfil. O e-mail é alterado pelo fluxo
 * próprio do Supabase Auth (com confirmação por e-mail).
 */
export async function updateNomeConta(nome: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nome })
    .eq("id", userData.user.id);

  if (error) throw error;
}

/**
 * Altera a senha do usuário logado.
 */
export async function alterarSenha(novaSenha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

/**
 * Altera o e-mail do usuário. O Supabase envia um e-mail de
 * confirmação para o novo endereço antes de efetivar a troca.
 */
export async function alterarEmail(novoEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email: novoEmail });
  if (error) throw error;
}
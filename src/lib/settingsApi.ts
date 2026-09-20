import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

export interface NotificacoesSettings {
  notif_novo_pedido: boolean;
  notif_pedido_cancelado: boolean;
  notif_estoque_minimo: boolean;
  notif_novo_cliente: boolean;
  notif_relatorio_semanal: boolean;
  notif_marketing: boolean;
}

export interface IntegracoesSettings {
  melhor_envio_token: string | null;
  correios_login: string | null;
  pix_chave: string | null;
  mercado_pago_token: string | null;
}

export type StoreSettings = NotificacoesSettings & IntegracoesSettings;

/**
 * Busca as configurações da loja. A linha em store_settings é
 * criada automaticamente por trigger quando a loja é criada,
 * mas garantimos a criação aqui caso ela não exista.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "notif_novo_pedido, notif_pedido_cancelado, notif_estoque_minimo, notif_novo_cliente, notif_relatorio_semanal, notif_marketing, melhor_envio_token, correios_login, pix_chave, mercado_pago_token"
    )
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw error;

  // Se ainda não existe linha de configurações, cria uma com os padrões
  if (!data) {
    const { data: criado, error: erroCriar } = await supabase
      .from("store_settings")
      .insert({ store_id: storeId })
      .select(
        "notif_novo_pedido, notif_pedido_cancelado, notif_estoque_minimo, notif_novo_cliente, notif_relatorio_semanal, notif_marketing, melhor_envio_token, correios_login, pix_chave, mercado_pago_token"
      )
      .single();

    if (erroCriar) throw erroCriar;
    return criado as StoreSettings;
  }

  return data as StoreSettings;
}

export async function updateNotificacoes(
  input: NotificacoesSettings
): Promise<void> {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("store_settings")
    .update(input)
    .eq("store_id", storeId);

  if (error) throw error;
}

export async function updateIntegracoes(
  input: IntegracoesSettings
): Promise<void> {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("store_settings")
    .update({
      melhor_envio_token: input.melhor_envio_token || null,
      correios_login: input.correios_login || null,
      pix_chave: input.pix_chave || null,
      mercado_pago_token: input.mercado_pago_token || null,
    })
    .eq("store_id", storeId);

  if (error) throw error;
}

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
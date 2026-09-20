import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";
import type { Store } from "../types/database";

export interface LojaFormData {
  nome: string;
  slug: string;
  descricao: string;
  whatsapp: string;
  email: string;
  politica_troca: string;
  politica_frete: string;
  ativo: boolean;
  manter_estoque: boolean;
  exibir_sem_estoque: boolean;
}

export function toFormData(store: Store): LojaFormData {
  return {
    nome: store.nome,
    slug: store.slug,
    descricao: store.descricao ?? "",
    whatsapp: store.whatsapp ?? "",
    email: store.email ?? "",
    politica_troca: store.politica_troca ?? "",
    politica_frete: store.politica_frete ?? "",
    ativo: store.ativo,
    manter_estoque: store.manter_estoque,
    exibir_sem_estoque: store.exibir_sem_estoque,
  };
}

/**
 * Busca a loja completa do usuário logado.
 */
export async function getMyStore(): Promise<Store> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", userData.user.id)
    .single();

  if (error || !data) {
    throw new Error("Loja não encontrada para este usuário.");
  }

  return data;
}

/**
 * Atualiza os dados da loja do usuário logado.
 */
export async function updateMyStore(input: LojaFormData): Promise<Store> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("stores")
    .update({
      nome: input.nome,
      slug: input.slug,
      descricao: input.descricao || null,
      whatsapp: input.whatsapp || null,
      email: input.email || null,
      politica_troca: input.politica_troca || null,
      politica_frete: input.politica_frete || null,
      ativo: input.ativo,
      manter_estoque: input.manter_estoque,
      exibir_sem_estoque: input.exibir_sem_estoque,
    })
    .eq("id", storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
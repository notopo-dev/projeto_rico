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
  cep_origem: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
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
    cep_origem: store.cep_origem ?? "",
    endereco_logradouro: store.endereco_logradouro ?? "",
    endereco_numero: store.endereco_numero ?? "",
    endereco_complemento: store.endereco_complemento ?? "",
    endereco_bairro: store.endereco_bairro ?? "",
    endereco_cidade: store.endereco_cidade ?? "",
    endereco_uf: store.endereco_uf ?? "",
  };
}

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
      cep_origem: input.cep_origem.replace(/\D/g, "") || null,
      endereco_logradouro: input.endereco_logradouro || null,
      endereco_numero: input.endereco_numero || null,
      endereco_complemento: input.endereco_complemento || null,
      endereco_bairro: input.endereco_bairro || null,
      endereco_cidade: input.endereco_cidade || null,
      endereco_uf: input.endereco_uf || null,
    })
    .eq("id", storeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface EnderecoViaCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export async function buscarEnderecoPorCep(
  cep: string
): Promise<EnderecoViaCep | null> {
  const cepLimpo = cep.replace(/\D/g, "");
  if (cepLimpo.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await res.json();
    if (data.erro) return null;

    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
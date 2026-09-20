import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

export interface Category {
  id: string;
  store_id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryInput {
  nome: string;
  slug?: string;
  ativa?: boolean;
}

/**
 * Gera um slug a partir do nome da categoria.
 *
 * Exemplo:
 * "Roupas Masculinas" → "roupas-masculinas"
 */
function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Lista todas as categorias da loja atual.
 *
 * Tabela utilizada:
 * categories
 */
export async function listCategories(): Promise<Category[]> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("store_id", storeId)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(
      `Erro ao carregar categorias: ${error.message}`
    );
  }

  return (data ?? []) as Category[];
}

/**
 * Lista categorias para utilização em selects,
 * como o campo de categoria do cadastro de produtos.
 *
 * Não filtramos por "ativa" aqui.
 *
 * Isso é importante porque uma categoria inativa ainda
 * pode estar vinculada a um produto existente e precisa
 * aparecer quando esse produto for editado.
 */
export async function listCategoriesForSelect(): Promise<
  { id: string; nome: string }[]
> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("categories")
    .select("id, nome")
    .eq("store_id", storeId)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(
      `Erro ao carregar categorias para seleção: ${error.message}`
    );
  }

  return data ?? [];
}

/**
 * Cria uma nova categoria.
 */
export async function createCategory(
  input: CategoryInput
): Promise<Category> {
  const storeId = await getCurrentStoreId();

  const nome = input.nome.trim();

  if (!nome) {
    throw new Error("O nome da categoria é obrigatório.");
  }

  const slug = (
    input.slug?.trim() || gerarSlug(nome)
  ).toLowerCase();

  if (!slug) {
    throw new Error("Não foi possível gerar o slug da categoria.");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      store_id: storeId,
      nome,
      slug,
      ativa: input.ativa ?? true,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Já existe uma categoria com esse slug."
      );
    }

    throw new Error(
      `Erro ao criar categoria: ${error.message}`
    );
  }

  return data as Category;
}

/**
 * Atualiza uma categoria existente.
 */
export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<Category> {
  const storeId = await getCurrentStoreId();

  const nome = input.nome.trim();

  if (!nome) {
    throw new Error("O nome da categoria é obrigatório.");
  }

  const slug = (
    input.slug?.trim() || gerarSlug(nome)
  ).toLowerCase();

  if (!slug) {
    throw new Error("Não foi possível gerar o slug da categoria.");
  }

  const { data, error } = await supabase
    .from("categories")
    .update({
      nome,
      slug,
      ...(input.ativa !== undefined
        ? { ativa: input.ativa }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("store_id", storeId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Já existe uma categoria com esse slug."
      );
    }

    throw new Error(
      `Erro ao atualizar categoria: ${error.message}`
    );
  }

  return data as Category;
}

/**
 * Ativa ou inativa uma categoria.
 */
export async function toggleCategory(
  id: string,
  ativa: boolean
): Promise<Category> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("categories")
    .update({
      ativa,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("store_id", storeId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Erro ao alterar status da categoria: ${error.message}`
    );
  }

  return data as Category;
}

/**
 * Exclui uma categoria.
 */
export async function deleteCategory(
  id: string
): Promise<void> {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId);

  if (error) {
    throw new Error(
      `Erro ao excluir categoria: ${error.message}`
    );
  }
}
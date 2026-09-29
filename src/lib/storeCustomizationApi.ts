import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";
import { validarImagem } from "./imagemSegura";

export interface StoreCustomization {
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  banner_url: string | null;
  modo_compra: "whatsapp" | "pagamento" | "ambos";
}

export async function getStoreCustomization(): Promise<StoreCustomization> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("stores")
    .select("cor_primaria, cor_secundaria, logo_url, banner_url, modo_compra")
    .eq("id", storeId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Salva a aparência da loja.
 *
 * Copia campo a campo de propósito. Antes era `.update(input)` com o
 * objeto do chamador repassado inteiro: o tipo `Partial<...>` só existe
 * na compilação, e em tempo de execução qualquer chave enviada chegava
 * ao update — inclusive `owner_id`, `slug`, `plano` ou
 * `assinatura_status`, pelo console do navegador.
 */
export async function updateStoreCustomization(
  input: Partial<StoreCustomization>
) {
  const storeId = await getCurrentStoreId();

  const permitido: Record<string, unknown> = {};
  if (input.cor_primaria !== undefined) permitido.cor_primaria = input.cor_primaria;
  if (input.cor_secundaria !== undefined) permitido.cor_secundaria = input.cor_secundaria;
  if (input.logo_url !== undefined) permitido.logo_url = input.logo_url;
  if (input.banner_url !== undefined) permitido.banner_url = input.banner_url;
  if (input.modo_compra !== undefined) permitido.modo_compra = input.modo_compra;

  if (Object.keys(permitido).length === 0) return;

  const { error } = await supabase
    .from("stores")
    .update(permitido)
    .eq("id", storeId);

  if (error) throw error;
}

/**
 * Faz upload do logo ou banner da loja para o Storage e
 * retorna a URL pública. Usa o bucket "store-assets".
 */
export async function uploadStoreAsset(
  file: File,
  tipo: "logo" | "banner"
): Promise<string> {
  // Logo e banner não tinham limite de tamanho nem checagem de tipo.
  const { ext, contentType } = await validarImagem(file, 5);

  const storeId = await getCurrentStoreId();
  const path = `${storeId}/${tipo}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("store-assets")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
  return data.publicUrl;
}
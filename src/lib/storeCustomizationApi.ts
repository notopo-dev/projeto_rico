import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

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

export async function updateStoreCustomization(
  input: Partial<StoreCustomization>
) {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("stores")
    .update(input)
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
  const storeId = await getCurrentStoreId();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${storeId}/${tipo}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("store-assets")
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
  return data.publicUrl;
}
import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  posicao: number;
}

const MAX_IMAGE_MB = 15;

/**
 * Faz upload de uma imagem para o Storage do Supabase, dentro
 * da pasta da loja atual, e registra a referência na tabela
 * product_images.
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  posicao: number
): Promise<ProductImage> {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" excede o limite de ${MAX_IMAGE_MB}MB.`);
  }

  const storeId = await getCurrentStoreId();

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${storeId}/${productId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      url: publicUrlData.publicUrl,
      posicao,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Envia várias imagens em sequência, mantendo a ordem escolhida.
 */
export async function uploadProductImages(
  productId: string,
  files: File[],
  startPosicao = 0
): Promise<ProductImage[]> {
  const results: ProductImage[] = [];
  for (let i = 0; i < files.length; i++) {
    const img = await uploadProductImage(productId, files[i], startPosicao + i);
    results.push(img);
  }
  return results;
}

export async function listProductImages(
  productId: string
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("posicao");

  if (error) throw error;
  return data ?? [];
}

/**
 * Remove a imagem do Storage e da tabela. Extrai o caminho do
 * arquivo a partir da URL pública salva.
 */
export async function deleteProductImage(image: ProductImage): Promise<void> {
  const marker = "/product-images/";
  const idx = image.url.indexOf(marker);
  if (idx !== -1) {
    const path = image.url.slice(idx + marker.length);
    await supabase.storage.from("product-images").remove([path]);
  }

  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", image.id);

  if (error) throw error;
}
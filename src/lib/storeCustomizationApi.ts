import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

export interface StoreCustomization {
  /**
   * Nome da loja, como o lojista escreveu.
   *
   * O painel mostrava o SLUG no topo, com "minhaloja" quando vazio —
   * o nome digitado no cadastro não aparecia em lugar nenhum. Vem
   * junto aqui porque Header e Sidebar já chamam esta função; buscar
   * numa consulta separada seria uma ida ao banco a mais em cada
   * carregamento de tela, pelo mesmo dado.
   */
  nome: string | null;
  slug: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  banner_url: string | null;
}

export async function getStoreCustomization(): Promise<StoreCustomization> {
  const storeId = await getCurrentStoreId();

  const { data, error } = await supabase
    .from("stores")
    .select(
      "nome, slug, cor_primaria, cor_secundaria, logo_url, banner_url",
    )
    .eq("id", storeId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateStoreCustomization(
  input: Partial<Omit<StoreCustomization, "nome" | "slug">>,
) {
  const storeId = await getCurrentStoreId();

  // modo_compra saiu daqui: ele passou para a tela Loja, que é onde o
  // WhatsApp é cadastrado. Esta função é chamada pelo Header e pela
  // Sidebar em toda troca de tela, e buscar uma coluna que ninguém mais
  // lê é peso em cada carregamento. Dois caminhos de escrita para o
  // mesmo campo também é como ele volta a divergir.
  //
  // nome e slug ficam de fora de propósito. Eles entraram na
  // interface para LEITURA; quem os grava é a tela Loja, que valida
  // obrigatoriedade e slug repetido. Deixar passar por aqui abriria
  // um segundo caminho sem essas checagens.
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
import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";
import { validarImagem } from "./imagemSegura";

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

/**
 * Teto de tamanho do logo e do banner.
 *
 * Mais baixo que o das fotos de produto (15MB) de propósito: o banner
 * é baixado por TODO visitante que abre a loja, inclusive no 4G. Foto
 * de produto só é baixada por quem abre aquele produto.
 */
const MAX_MARCA_MB = 8;

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
 * Faz upload do logo ou banner da loja para o Storage e devolve a URL
 * pública. Usa o bucket "store-assets".
 *
 * ----------------------------------------------------------------
 * Por que a extensão NÃO sai do nome do arquivo
 * ----------------------------------------------------------------
 * Vinha de `file.name.split(".").pop()`, e o Content-Type do objeto
 * saía de `file.type`. Os dois são escolhidos por quem envia. Com isso
 * dava para publicar um SVG com <script> dentro num bucket público, no
 * domínio da própria plataforma — não rouba a sessão do painel, porque
 * a origem é outra, mas serve de golpe hospedado no nosso endereço.
 * Também não havia limite de tamanho NENHUM aqui.
 *
 * `validarImagem` já existia e já resolvia isso, e as fotos de produto
 * já a usavam — só este caminho tinha ficado de fora. Agora a extensão
 * e o Content-Type vêm dos PRIMEIROS BYTES do arquivo.
 *
 * ----------------------------------------------------------------
 * Por que a URL leva `?v=`
 * ----------------------------------------------------------------
 * O caminho é fixo por loja e por tipo (`<loja>/banner.png`), com
 * `upsert`. Trocar o banner por outro do mesmo formato gravava o
 * arquivo novo na MESMA URL — e a Supabase serve esses objetos com
 * `cache-control: public, max-age=3600`. Resultado: a URL gravada no
 * banco não mudava, e o navegador, o CDN e até a pré-visualização do
 * painel continuavam mostrando a imagem velha por até uma hora. Era o
 * caso de "troquei o banner e não mudou nada".
 *
 * O `?v=` é a versão: muda a URL a cada envio, então todo mundo busca
 * de novo na hora. O caminho continua fixo, de propósito — assim não
 * se acumula um arquivo abandonado no Storage a cada troca.
 *
 * Observação honesta: trocar de FORMATO (um PNG por um JPG) muda o
 * caminho para `banner.jpg` e deixa o `banner.png` antigo parado no
 * bucket. Não apago aqui porque este arquivo ainda é o que está no ar
 * até o lojista clicar em Salvar — apagar antes disso derrubaria o
 * banner da loja se ele desistisse.
 */
export async function uploadStoreAsset(
  file: File,
  tipo: "logo" | "banner"
): Promise<string> {
  const { ext, contentType } = await validarImagem(file, MAX_MARCA_MB);

  const storeId = await getCurrentStoreId();
  const path = `${storeId}/${tipo}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("store-assets")
    .upload(path, file, { cacheControl: "3600", contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";
import type { Product } from "../types/database";


export interface ProductColor {
  id: string;
  product_id: string;
  nome: string;
  codigo_hex: string | null;
  imagem_url: string | null;
}


export interface ProductSize {
  id: string;
  product_id: string;
  tamanho: string;
}


export interface ProductWithCategoria extends Product {

  categoria_nome: string | null;

  imagens: {
    id: string;
    url: string;
    posicao: number;
  }[];

  cores: ProductColor[];

  tamanhos: ProductSize[];

}



export async function listProducts(): Promise<ProductWithCategoria[]> {

  const storeId = await getCurrentStoreId();


  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      categories(nome),
      product_images(id,url,posicao),
      product_colors(
        id,
        nome,
        codigo_hex,
        imagem_url
      ),
      product_sizes(
        id,
        tamanho
      )
    `)
    .eq("store_id", storeId)
    .order("created_at",{ascending:false});


  if(error) throw error;


  return (data ?? []).map((p:any)=>({

    ...p,

    categoria_nome:
      p.categories?.nome ?? null,


    imagens:
      (p.product_images ?? [])
      .sort(
        (a:any,b:any)=>
        a.posicao-b.posicao
      ),


    cores:
      p.product_colors ?? [],


    tamanhos:
      p.product_sizes ?? []

  }));

}





export interface ProductInput {

  nome:string;

  sku:string;

  descricao:string;

  preco:number;

  preco_promocional:number|null;

  estoque:number;

  estoque_minimo:number;

  category_id:string|null;

  permite_venda_sem_estoque:boolean;


  item_promocao:boolean;

  /**
   * O lojista quer este produto na vitrine?
   *
   * Opcional para não quebrar nenhuma chamada antiga: ausente vale
   * como `true`. Falso grava status "inativo", e o cálculo
   * automático respeita.
   */
  a_venda?:boolean;


  cores:{
    nome:string;
    codigo_hex:string|null;
    imagem_url:string|null;
  }[];


  tamanhos:string[];


  // Peso e medidas do produto embalado — usados no cálculo
  // de frete pelo Melhor Envio. Sem eles, o produto não pode
  // ser cotado no checkout.
  peso_gramas:number|null;

  altura_cm:number|null;

  largura_cm:number|null;

  comprimento_cm:number|null;

}




/**
 * O status do produto.
 *
 * ----------------------------------------------------------------
 * Por que a escolha do lojista entra aqui
 * ----------------------------------------------------------------
 * Esta função era chamada em toda gravação e só devolvia "ativo" ou
 * "sem_estoque" — nunca "inativo". Duas consequências, as duas
 * ruins:
 *
 *   1. O lojista não tinha como tirar um produto da vitrine. O
 *      "Ativo" na lista era selo de leitura, e nenhum formulário
 *      oferecia o campo.
 *   2. Pior: se algo marcasse o produto como inativo por outro
 *      caminho, a PRÓXIMA edição recalculava o status e voltava para
 *      ativo em silêncio. O produto reaparecia na loja sem ninguém
 *      ter pedido.
 *
 * Agora a vontade do lojista manda. O cálculo automático só decide
 * entre "ativo" e "sem_estoque" DENTRO de um produto que ele deixou
 * à venda.
 */
function calcularStatus(
  estoque: number,
  permiteVendaSemEstoque: boolean,
  aVenda: boolean,
): "ativo" | "inativo" | "sem_estoque" {
  if (!aVenda) return "inativo";
  if (estoque > 0) return "ativo";
  return permiteVendaSemEstoque ? "ativo" : "sem_estoque";
}






function gerarSlug(nome:string){

return nome
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.replace(/\s+/g,"-")
.replace(/[^a-z0-9-]/g,"")
.replace(/-+/g,"-")
.replace(/^-|-$/g,"");

}


/**
 * Acha um endereço livre para o produto dentro da loja.
 *
 * Virou necessário quando o slug ganhou índice único por loja.
 * Antes, dois produtos com o mesmo nome conviviam e um dos dois
 * ficava inalcançável pelo link, em silêncio. Agora o banco recusa,
 * e sem isto o lojista veria o cadastro falhar ao criar a segunda
 * "Camiseta Branca" — uma coisa que hoje funciona.
 *
 * Acrescenta -2, -3... até achar livre. Não uso sufixo aleatório: o
 * endereço é o que ele cola no Instagram, e "camiseta-branca-2" se
 * lê em voz alta, "camiseta-branca-x7f3" não.
 */
async function slugDisponivel(
  storeId: string,
  base: string,
  ignorarId?: string
): Promise<string> {

  const raiz = base || "produto";

  for (let n = 1; n < 100; n++) {

    const tentativa = n === 1 ? raiz : `${raiz}-${n}`;

    let q = supabase
      .from("products")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", tentativa);

    if (ignorarId) q = q.neq("id", ignorarId);

    const { data, error } = await q.limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return tentativa;
  }

  return `${raiz}-${Date.now().toString(36)}`;
}







export async function createProduct(
 input:ProductInput
):Promise<Product>{


const storeId =
await getCurrentStoreId();


const slug =
await slugDisponivel(
storeId,
gerarSlug(input.nome)
);



const {data,error}=await supabase
.from("products")
.insert({

store_id:storeId,

nome:input.nome,

slug,

descricao:
input.descricao || null,

sku:input.sku,

preco:input.preco,

preco_promocional:
input.preco_promocional,

estoque:
input.estoque,

estoque_minimo:
input.estoque_minimo,

category_id:
input.category_id,

permite_venda_sem_estoque:
input.permite_venda_sem_estoque,


item_promocao:
input.item_promocao,


peso_gramas:
input.peso_gramas,

altura_cm:
input.altura_cm,

largura_cm:
input.largura_cm,

comprimento_cm:
input.comprimento_cm,


status:
calcularStatus(
input.estoque,
input.permite_venda_sem_estoque,
// Produto novo nasce à venda quando o campo não vem.
input.a_venda ?? true
)

})
.select()
.single();



if(error)
throw error;



await salvarVariacoes(
data.id,
input
);



return data;


}









export async function updateProduct(
id:string,
input:ProductInput
):Promise<Product>{



const {data,error}=await supabase
.from("products")
.update({

nome:input.nome,

descricao:
input.descricao || null,

sku:input.sku,

preco:input.preco,

preco_promocional:
input.preco_promocional,

estoque:
input.estoque,

estoque_minimo:
input.estoque_minimo,

category_id:
input.category_id,

permite_venda_sem_estoque:
input.permite_venda_sem_estoque,


item_promocao:
input.item_promocao,


peso_gramas:
input.peso_gramas,

altura_cm:
input.altura_cm,

largura_cm:
input.largura_cm,

comprimento_cm:
input.comprimento_cm,


status:
calcularStatus(
input.estoque,
input.permite_venda_sem_estoque,
// Produto novo nasce à venda quando o campo não vem.
input.a_venda ?? true
)

})
.eq("id",id)
.select()
.single();



if(error)
throw error;



await salvarVariacoes(
id,
input
);



return data;

}









async function salvarVariacoes(
productId:string,
input:ProductInput
){

const delColors = await supabase
.from("product_colors")
.delete()
.eq("product_id", productId);

if(delColors.error){
  throw delColors.error;
}


if(input.cores && input.cores.length){

const { error } = await supabase
.from("product_colors")
.insert(
input.cores.map((c:any)=>({
product_id: productId,
nome: c.nome,
codigo_hex: c.codigo_hex ?? null,
imagem_url: c.imagem_url ?? null
}))
);

if(error){
 throw error;
}

}



const delSizes = await supabase
.from("product_sizes")
.delete()
.eq("product_id", productId);

if(delSizes.error){
 throw delSizes.error;
}



if(input.tamanhos && input.tamanhos.length){

const { error } = await supabase
.from("product_sizes")
.insert(
input.tamanhos.map((t:any)=>({
product_id: productId,
tamanho: typeof t === "string" ? t : t.tamanho
}))
);

if(error){
 throw error;
}

}

}








export async function getProductById(
id:string
):Promise<ProductWithCategoria>{


const {data,error}=await supabase
.from("products")
.select(`
*,
categories(nome),
product_images(id,url,posicao),
product_colors(
id,
nome,
codigo_hex,
imagem_url
),
product_sizes(
id,
tamanho
)
`)
.eq("id",id)
.single();



if(error)
throw error;



const p:any=data;



return {

...p,

categoria_nome:
p.categories?.nome ?? null,


imagens:
(p.product_images??[])
.sort(
(a:any,b:any)=>
a.posicao-b.posicao
),


cores:
p.product_colors??[],


tamanhos:
p.product_sizes??[]

};


}








/**
 * Produto que já foi vendido e por isso não pode ser apagado.
 *
 * Classe própria para a tela distinguir este caso dos outros erros e
 * oferecer "Inativar" no lugar do apagar.
 */
export class ProdutoEmPedidos extends Error {
  constructor() {
    super(
      "Este produto já aparece em pedidos e não pode ser apagado — " +
        "apagar levaria o histórico de venda junto. " +
        'Desligue o botão "à venda" na lista: ele sai da vitrine e ' +
        "continua nos pedidos antigos.",
    );
    this.name = "ProdutoEmPedidos";
  }
}

/**
 * Tira o produto da vitrine sem apagar nada.
 *
 * É a saída para o produto já vendido. Atualiza só o status — nada de
 * mexer em preço, estoque ou imagens de passagem.
 */
/**
 * Liga e desliga o produto na vitrine, sem abrir o formulário.
 *
 * Grava o status direto. Ao LIGAR, recalcula: um produto com estoque
 * zerado e sem "vender sem estoque" volta como "sem_estoque", não
 * como "ativo" — senão a vitrine ofereceria peça que não existe.
 */
export async function alternarProdutoAVenda(
  id: string,
  aVenda: boolean,
): Promise<"ativo" | "inativo" | "sem_estoque"> {
  let novo: "ativo" | "inativo" | "sem_estoque" = "inativo";

  if (aVenda) {
    const { data, error: erroLeitura } = await supabase
      .from("products")
      .select("estoque, permite_venda_sem_estoque")
      .eq("id", id)
      .single();

    if (erroLeitura) throw new Error(erroLeitura.message);

    novo = calcularStatus(
      Number(data?.estoque ?? 0),
      Boolean(data?.permite_venda_sem_estoque),
      true,
    );
  }

  const { error } = await supabase
    .from("products")
    .update({ status: novo })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Não foi possível alterar o produto.");
  }
  return novo;
}

export async function inativarProduto(id: string): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ status: "inativo" })
    .eq("id", id);

  if (error) {
    throw new Error(
      error.message || "Não foi possível inativar o produto. Tente de novo.",
    );
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (!error) return;

  /**
   * Por que isto não é mais `throw error`.
   *
   * O erro do Supabase (PostgrestError) é um objeto simples — não é
   * uma instância de Error. A tela faz
   * `err instanceof Error ? err.message : "Erro ao excluir produto."`,
   * então o `false` caía no texto genérico e o motivo REAL morria no
   * caminho. O lojista via "Erro ao excluir produto." e não tinha
   * como descobrir o que fazer.
   */

  // 23503 = foreign_key_violation. O produto está em pedidos, e o
  // banco recusa apagar — corretamente: apagar levaria o histórico
  // do pedido junto. Não é falha, é proteção.
  //
  // Erro de classe própria para a tela poder OFERECER a saída em vez
  // de só contar qual é: quem está com o produto na mão quer resolver
  // ali, não ir procurar o campo de status no formulário.
  if (error.code === "23503") {
    throw new ProdutoEmPedidos();
  }

  // 42501 = insufficient_privilege. Quase sempre sessão expirada.
  if (error.code === "42501") {
    throw new Error(
      "Sem permissão para excluir. Saia e entre de novo; se continuar, fale com o suporte.",
    );
  }

  throw new Error(
    error.message || "Não foi possível excluir o produto. Tente de novo.",
  );
}

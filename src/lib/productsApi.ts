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




function calcularStatus(
 estoque:number,
 permiteVendaSemEstoque:boolean
){

 if(estoque>0)
 return "ativo";


 return permiteVendaSemEstoque
 ? "ativo"
 : "sem_estoque";

}






function gerarSlug(nome:string){

return nome
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.replace(/\s+/g,"-")
.replace(/[^a-z0-9-]/g,"");

}







export async function createProduct(
 input:ProductInput
):Promise<Product>{


const storeId =
await getCurrentStoreId();


const slug =
gerarSlug(input.nome);



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
input.permite_venda_sem_estoque
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
input.permite_venda_sem_estoque
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








export async function deleteProduct(
id:string
){

const {error}=await supabase
.from("products")
.delete()
.eq("id",id);


if(error)
throw error;

}






export async function listCategoriesForSelect(){

const storeId =
await getCurrentStoreId();


const {data,error}=await supabase
.from("categories")
.select("id,nome")
.eq("store_id",storeId)
.order("nome");


if(error)
throw error;


return data ?? [];

}
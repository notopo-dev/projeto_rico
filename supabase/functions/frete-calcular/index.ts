// ============================================================
// frete-calcular
// Calcula as opções de frete via Melhor Envio para o carrinho
// do cliente final na loja pública.
//
// Chamada pelo CLIENTE FINAL (anônimo), então usa service role
// para ler a loja e os produtos — a validação é: a loja precisa
// estar ativa e os produtos precisam pertencer a ela.
//
// https://docs.melhorenvio.com.br/
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  cabecalhosME,
  ErroMelhorEnvio,
  obterAcesso,
} from "../_shared/melhorEnvio.ts";
import {
  dentroDoLimite,
  origemDaChamada,
  respostaLimite,
} from "../_shared/limite.ts";

interface ItemCarrinho {
  product_id: string;
  quantidade: number;
}

interface RequestBody {
  storeId: string;
  cepDestino: string;
  itens: ItemCarrinho[];
}

interface OpcaoFrete {
  id: number;
  nome: string;
  transportadora: string;
  preco: number;
  prazo_dias: number;
  erro?: string;
}

function apenasDigitos(v: string) {
  return v.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, cepDestino, itens }: RequestBody = await req.json();

    const cepLimpo = apenasDigitos(cepDestino ?? "");
    if (!storeId || cepLimpo.length !== 8 || !itens?.length) {
      return new Response(
        JSON.stringify({ error: "Informe um CEP válido e os itens do carrinho." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Função aberta, sem login, que gasta a cota do Melhor Envio do
    // lojista a cada chamada. Sem limite, qualquer pessoa queima o
    // token da loja num laço e o frete para de funcionar para todo
    // mundo. O limite é por origem E por loja: um atacante não derruba
    // a cota de uma loja alheia consumindo o limite dela.
    if (
      !(await dentroDoLimite(supabaseAdmin, `frete:${origemDaChamada(req)}`, 30, 60)) ||
      !(await dentroDoLimite(supabaseAdmin, `frete-loja:${storeId}`, 300, 60))
    ) {
      return respostaLimite(corsHeaders);
    }

    // 1. Busca a loja (precisa estar ativa e ter CEP de origem)
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, ativo, cep_origem, email")
      .eq("id", storeId)
      .single();

    if (storeError || !store || !store.ativo) {
      return new Response(JSON.stringify({ error: "Loja não encontrada ou inativa." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!store.cep_origem) {
      return new Response(
        JSON.stringify({
          error: "A loja ainda não configurou o CEP de origem para envio.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Token válido da loja.
    //
    // Renovado aqui dentro se estiver perto de vencer — o access_token
    // do Melhor Envio dura 30 dias, e sem isso a loja pararia de cotar
    // frete um mês depois de conectar, sem ninguém perceber.
    let acesso;
    try {
      acesso = await obterAcesso(supabaseAdmin, storeId);
    } catch (err) {
      if (err instanceof ErroMelhorEnvio) {
        // "não configurou" é o texto que o checkout procura para cair
        // em "frete a combinar" em silêncio, em vez de mostrar erro
        // técnico para quem está comprando.
        return new Response(
          JSON.stringify({ error: "A loja ainda não configurou o Melhor Envio." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    const baseUrl = acesso.base;

    // 3. Busca dimensões e peso dos produtos do carrinho
    const productIds = itens.map((i) => i.product_id);
    const { data: produtos, error: produtosError } = await supabaseAdmin
      .from("products")
      .select("id, nome, preco, preco_promocional, peso_gramas, altura_cm, largura_cm, comprimento_cm")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (produtosError || !produtos?.length) {
      return new Response(JSON.stringify({ error: "Produtos não encontrados." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se todos têm dimensões cadastradas
    const semDimensoes = produtos.filter(
      (p: any) => !p.peso_gramas || !p.altura_cm || !p.largura_cm || !p.comprimento_cm
    );
    if (semDimensoes.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Produto sem dimensões cadastradas: ${semDimensoes
            .map((p: any) => p.nome)
            .join(", ")}. O lojista precisa informar peso e medidas.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Monta os produtos no formato do Melhor Envio
    const produtosPayload = itens.map((item) => {
      const p: any = produtos.find((x: any) => x.id === item.product_id);
      return {
        id: p.id,
        width: Number(p.largura_cm),
        height: Number(p.altura_cm),
        length: Number(p.comprimento_cm),
        weight: Number(p.peso_gramas) / 1000, // Melhor Envio usa kg
        insurance_value: Number(p.preco_promocional ?? p.preco),
        quantity: item.quantidade,
      };
    });

    // 5. Chama a API de cálculo do Melhor Envio
    const res = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: cabecalhosME(acesso.token, store.email),
      body: JSON.stringify({
        from: { postal_code: apenasDigitos(store.cep_origem) },
        to: { postal_code: cepLimpo },
        products: produtosPayload,
      }),
    });

    const dados = await res.json();

    if (!res.ok) {
      console.error("Erro Melhor Envio:", dados);
      return new Response(
        JSON.stringify({
          error: dados?.message ?? "Não foi possível calcular o frete agora.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Normaliza a resposta, descartando serviços indisponíveis
    const opcoes: OpcaoFrete[] = (Array.isArray(dados) ? dados : [])
      .filter((s: any) => !s.error && s.price)
      .map((s: any) => ({
        id: s.id,
        nome: s.name,
        transportadora: s.company?.name ?? "",
        preco: Number(s.price),
        prazo_dias: Number(s.delivery_time ?? 0),
      }))
      .sort((a, b) => a.preco - b.preco);

    return new Response(JSON.stringify({ opcoes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Quem chama é o cliente final, anônimo. Detalhe interno fica no
    // log, não na tela de quem está comprando.
    console.error("Erro ao calcular frete:", err);
    return new Response(
      JSON.stringify({ error: "Não foi possível calcular o frete agora." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
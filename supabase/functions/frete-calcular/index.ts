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

    // 1. Busca a loja (precisa estar ativa e ter CEP de origem)
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, ativo, cep_origem")
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

    // 2. Busca o token do Melhor Envio da loja
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("melhor_envio_token, melhor_envio_ambiente")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!settings?.melhor_envio_token) {
      return new Response(
        JSON.stringify({ error: "A loja ainda não configurou o Melhor Envio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl =
      settings.melhor_envio_ambiente === "producao"
        ? "https://melhorenvio.com.br"
        : "https://sandbox.melhorenvio.com.br";

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
      headers: {
        Authorization: `Bearer ${settings.melhor_envio_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "LojaPro (contato@lojapro.com.br)",
      },
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
    console.error("Erro ao calcular frete:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
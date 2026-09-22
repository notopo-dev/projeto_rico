// ============================================================
// frete-gerar-etiqueta
// Gera a etiqueta de envio de um pedido via Melhor Envio.
// Chamada pelo LOJISTA (autenticado) no painel.
//
// O fluxo do Melhor Envio tem 3 etapas:
//   1. /cart      — adiciona o envio ao carrinho
//   2. /checkout  — paga com o saldo da conta Melhor Envio
//   3. /generate  — gera a etiqueta (PDF)
//
// https://docs.melhorenvio.com.br/
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

function apenasDigitos(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Pedido não informado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Loja do lojista logado
    const { data: store } = await supabase
      .from("stores")
      .select(
        "id, nome, email, whatsapp, cep_origem, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf"
      )
      .eq("owner_id", user.id)
      .single();

    if (!store) {
      return new Response(JSON.stringify({ error: "Loja não encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("melhor_envio_token, melhor_envio_ambiente")
      .eq("store_id", store.id)
      .maybeSingle();

    if (!settings?.melhor_envio_token) {
      return new Response(
        JSON.stringify({ error: "Configure o Melhor Envio antes de gerar etiquetas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl =
      settings.melhor_envio_ambiente === "producao"
        ? "https://melhorenvio.com.br"
        : "https://sandbox.melhorenvio.com.br";

    const meHeaders = {
      Authorization: `Bearer ${settings.melhor_envio_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "LojaPro (contato@lojapro.com.br)",
    };

    // Pedido + cliente + itens
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(
        "id, numero, frete_servico, cep_entrega, endereco_entrega, melhor_envio_order_id, customers(nome, email, telefone, cpf), order_items(nome_produto, quantidade, preco_unitario, products(peso_gramas, altura_cm, largura_cm, comprimento_cm))"
      )
      .eq("id", orderId)
      .eq("store_id", store.id)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se a etiqueta já existe, só devolve
    if (order.melhor_envio_order_id) {
      return new Response(
        JSON.stringify({
          jaExiste: true,
          melhorEnvioOrderId: order.melhor_envio_order_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cliente: any = order.customers;
    const endereco: any = order.endereco_entrega ?? {};
    const itens: any[] = order.order_items ?? [];

    if (!order.frete_servico) {
      return new Response(
        JSON.stringify({ error: "Este pedido não tem serviço de frete selecionado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------
    // 1. Adiciona ao carrinho do Melhor Envio
    // ---------------------------------------------------------
    const volumes = itens.map((item) => {
      const p = item.products ?? {};
      return {
        height: Number(p.altura_cm ?? 2),
        width: Number(p.largura_cm ?? 11),
        length: Number(p.comprimento_cm ?? 16),
        weight: Number(p.peso_gramas ?? 300) / 1000,
      };
    });

    const valorSegurado = itens.reduce(
      (soma, i) => soma + Number(i.preco_unitario) * i.quantidade,
      0
    );

    const cartRes = await fetch(`${baseUrl}/api/v2/me/cart`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({
        service: Number(order.frete_servico),
        from: {
          name: store.nome,
          email: store.email ?? undefined,
          phone: apenasDigitos(store.whatsapp ?? ""),
          address: store.endereco_logradouro,
          number: store.endereco_numero,
          complement: store.endereco_complemento ?? undefined,
          district: store.endereco_bairro,
          city: store.endereco_cidade,
          state_abbr: store.endereco_uf,
          postal_code: apenasDigitos(store.cep_origem ?? ""),
          country_id: "BR",
        },
        to: {
          name: cliente?.nome ?? "Cliente",
          email: cliente?.email ?? undefined,
          phone: apenasDigitos(cliente?.telefone ?? ""),
          document: apenasDigitos(cliente?.cpf ?? ""),
          address: endereco.logradouro ?? endereco.address ?? "",
          number: endereco.numero ?? endereco.number ?? "S/N",
          complement: endereco.complemento ?? undefined,
          district: endereco.bairro ?? endereco.district ?? "",
          city: endereco.cidade ?? endereco.city ?? "",
          state_abbr: endereco.uf ?? endereco.state ?? "",
          postal_code: apenasDigitos(order.cep_entrega ?? endereco.cep ?? ""),
          country_id: "BR",
        },
        products: itens.map((i) => ({
          name: i.nome_produto,
          quantity: i.quantidade,
          unitary_value: Number(i.preco_unitario),
        })),
        volumes,
        options: {
          insurance_value: valorSegurado,
          receipt: false,
          own_hand: false,
          reverse: false,
          non_commercial: true,
        },
      }),
    });

    const cartData = await cartRes.json();
    if (!cartRes.ok) {
      console.error("Erro ao adicionar ao carrinho:", cartData);
      return new Response(
        JSON.stringify({
          error: cartData?.message ?? "Erro ao registrar envio no Melhor Envio.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const melhorEnvioOrderId = cartData.id;

    // ---------------------------------------------------------
    // 2. Paga (usa o saldo da conta Melhor Envio do lojista)
    // ---------------------------------------------------------
    const checkoutRes = await fetch(`${baseUrl}/api/v2/me/shipment/checkout`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [melhorEnvioOrderId] }),
    });

    const checkoutData = await checkoutRes.json();
    if (!checkoutRes.ok) {
      console.error("Erro no checkout Melhor Envio:", checkoutData);
      // Guarda o id mesmo assim, para o lojista poder pagar manualmente
      await supabaseAdmin
        .from("orders")
        .update({
          melhor_envio_order_id: melhorEnvioOrderId,
          etiqueta_status: "pendente",
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({
          error:
            checkoutData?.message ??
            "Envio registrado, mas o pagamento falhou. Verifique o saldo da sua conta no Melhor Envio.",
          melhorEnvioOrderId,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------
    // 3. Gera a etiqueta
    // ---------------------------------------------------------
    const generateRes = await fetch(`${baseUrl}/api/v2/me/shipment/generate`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [melhorEnvioOrderId] }),
    });

    const generateData = await generateRes.json();
    if (!generateRes.ok) {
      console.error("Erro ao gerar etiqueta:", generateData);
      await supabaseAdmin
        .from("orders")
        .update({
          melhor_envio_order_id: melhorEnvioOrderId,
          etiqueta_status: "paga",
        })
        .eq("id", orderId);

      return new Response(
        JSON.stringify({
          error: generateData?.message ?? "Etiqueta paga, mas não pôde ser gerada ainda.",
          melhorEnvioOrderId,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------
    // 4. Busca o link do PDF e o código de rastreio
    // ---------------------------------------------------------
    const printRes = await fetch(`${baseUrl}/api/v2/me/shipment/print`, {
      method: "POST",
      headers: meHeaders,
      body: JSON.stringify({ orders: [melhorEnvioOrderId], mode: "public" }),
    });
    const printData = await printRes.json();

    const infoRes = await fetch(
      `${baseUrl}/api/v2/me/shipment/tracking`,
      {
        method: "POST",
        headers: meHeaders,
        body: JSON.stringify({ orders: [melhorEnvioOrderId] }),
      }
    );
    const infoData = await infoRes.json();
    const rastreio =
      infoData?.[melhorEnvioOrderId]?.tracking ??
      infoData?.[melhorEnvioOrderId]?.protocol ??
      null;

    await supabaseAdmin
      .from("orders")
      .update({
        melhor_envio_order_id: melhorEnvioOrderId,
        etiqueta_url: printData?.url ?? null,
        codigo_rastreio: rastreio,
        etiqueta_status: "gerada",
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({
        sucesso: true,
        melhorEnvioOrderId,
        etiquetaUrl: printData?.url ?? null,
        codigoRastreio: rastreio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao gerar etiqueta:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
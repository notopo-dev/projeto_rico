// ============================================================
// frete-rastrear
// Consulta o rastreamento de um pedido no Melhor Envio.
// Pode ser chamada pelo lojista (painel) ou pelo cliente final
// (tela "Meus pedidos"), por isso valida de formas diferentes:
//   - com token de lojista: rastreia qualquer pedido da loja
//   - sem token: exige CPF + telefone do cliente, igual à
//     consulta pública de pedidos
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  cabecalhosME,
  ErroMelhorEnvio,
  obterAcesso,
} from "../_shared/melhorEnvio.ts";

function apenasDigitos(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, storeId, cpf, telefone } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Pedido não informado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    let lojaIdAutorizada: string | null = null;

    // Caminho 1: lojista autenticado
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .eq("owner_id", user.id)
          .single();
        lojaIdAutorizada = store?.id ?? null;
      }
    }

    // Caminho 2: cliente final, valida CPF + telefone
    if (!lojaIdAutorizada) {
      if (!storeId || !cpf || !telefone) {
        return new Response(
          JSON.stringify({ error: "Informe CPF e telefone para consultar." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: cliente } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("store_id", storeId)
        .eq("cpf", apenasDigitos(cpf))
        .eq("telefone", apenasDigitos(telefone))
        .maybeSingle();

      if (!cliente) {
        return new Response(JSON.stringify({ error: "Dados não conferem." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      lojaIdAutorizada = storeId;
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, melhor_envio_order_id, codigo_rastreio")
      .eq("id", orderId)
      .eq("store_id", lojaIdAutorizada)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.melhor_envio_order_id) {
      return new Response(
        JSON.stringify({ semEnvio: true, mensagem: "Este pedido ainda não foi postado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token válido da loja. O helper renova sozinho se estiver perto
    // de vencer — o access_token do Melhor Envio dura 30 dias.
    let acesso;
    try {
      acesso = await obterAcesso(supabaseAdmin, order.store_id);
    } catch (err) {
      if (err instanceof ErroMelhorEnvio) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    const baseUrl = acesso.base;

    const res = await fetch(`${baseUrl}/api/v2/me/shipment/tracking`, {
      method: "POST",
      headers: cabecalhosME(acesso.token),
      body: JSON.stringify({ orders: [order.melhor_envio_order_id] }),
    });

    const dados = await res.json();
    if (!res.ok) {
      console.error("Erro ao rastrear:", dados);
      return new Response(
        JSON.stringify({ error: dados?.message ?? "Erro ao consultar rastreamento." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const info = dados?.[order.melhor_envio_order_id] ?? {};
    const rastreio = info.tracking ?? order.codigo_rastreio ?? null;

    // Atualiza o código de rastreio se veio agora
    if (rastreio && rastreio !== order.codigo_rastreio) {
      await supabaseAdmin
        .from("orders")
        .update({ codigo_rastreio: rastreio })
        .eq("id", order.id);
    }

    return new Response(
      JSON.stringify({
        codigoRastreio: rastreio,
        status: info.status ?? null,
        transportadora: info.melhorenvio_tracking ?? null,
        eventos: info.tracking_events ?? info.events ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro ao rastrear:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
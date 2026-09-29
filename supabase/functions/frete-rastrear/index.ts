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
  dentroDoLimite,
  origemDaChamada,
  respostaLimite,
} from "../_shared/limite.ts";

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

    // Consulta por CPF + telefone sem login. Sem limite, vira
    // ferramenta de varredura: testar pares até descobrir quem é
    // cliente da loja.
    if (!(await dentroDoLimite(supabaseAdmin, `rastreio:${origemDaChamada(req)}`, 15, 60))) {
      return respostaLimite(corsHeaders);
    }

    const authHeader = req.headers.get("Authorization");
    let lojaIdAutorizada: string | null = null;
    /**
     * Quando quem consulta é o CLIENTE FINAL, o pedido precisa ser
     * dele — não basta ser da mesma loja.
     *
     * Antes, provar CPF e telefone liberava a loja inteira: bastava
     * comprar uma vez para poder rastrear o pedido de qualquer outro
     * cliente daquela loja. Agora a prova é confrontada com a
     * identidade gravada NO PEDIDO.
     */
    let exigirDonoDoPedido: { cpf: string; telefone: string } | null = null;

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

      const cpfLimpo = apenasDigitos(cpf);
      const telLimpo = apenasDigitos(telefone);

      // Exige documento completo. Sem isto, campo curto ou vazio casa
      // com muita coisa e vira ferramenta de varredura.
      if (cpfLimpo.length !== 11 || telLimpo.length < 10) {
        return new Response(
          JSON.stringify({ error: "Informe CPF e telefone completos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lojaIdAutorizada = storeId;
      exigirDonoDoPedido = { cpf: cpfLimpo, telefone: telLimpo };
    }

    let consulta = supabaseAdmin
      .from("orders")
      .select("id, store_id, melhor_envio_order_id, codigo_rastreio, cpf_comprador, telefone_comprador")
      .eq("id", orderId)
      .eq("store_id", lojaIdAutorizada);

    // Cliente final: o pedido tem que ser DELE. A identidade fica
    // gravada na própria compra (13_identidade_no_pedido.sql), que é
    // justamente a prova de quem comprou naquele dia.
    if (exigirDonoDoPedido) {
      consulta = consulta
        .eq("cpf_comprador", exigirDonoDoPedido.cpf)
        .eq("telefone_comprador", exigirDonoDoPedido.telefone);
    }

    const { data: order } = await consulta.maybeSingle();

    if (!order) {
      // Mesma resposta para pedido inexistente e para pedido de outra
      // pessoa. Distinguir os dois casos transformaria esta função num
      // verificador de "esse CPF comprou aqui?".
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

    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("melhor_envio_token, melhor_envio_ambiente")
      .eq("store_id", order.store_id)
      .maybeSingle();

    if (!settings?.melhor_envio_token) {
      return new Response(
        JSON.stringify({ error: "Loja sem Melhor Envio configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl =
      settings.melhor_envio_ambiente === "producao"
        ? "https://melhorenvio.com.br"
        : "https://sandbox.melhorenvio.com.br";

    const res = await fetch(`${baseUrl}/api/v2/me/shipment/tracking`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.melhor_envio_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "LojaPro (contato@lojapro.com.br)",
      },
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
// ============================================================
// emails-processar
//
// Drena a fila `emails_fila` e envia pelo Resend.
//
// ------------------------------------------------------------
// Por que uma função que DRENA, em vez de uma que envia
// ------------------------------------------------------------
// Não existe agendador neste banco (sem pg_cron, sem pg_net), então
// o Postgres não consegue chamar nada sozinho. Quem chama esta
// função é quem já estava ali de qualquer forma: o checkout depois
// de criar o pedido, o webhook do Stripe ao confirmar pagamento, e o
// painel ao mudar o status.
//
// Como ela drena a fila inteira e não uma mensagem específica, uma
// chamada que falhe não perde nada: a mensagem continua pendente e
// sai na próxima. É o oposto de "enviar e torcer".
//
// ------------------------------------------------------------
// Segurança
// ------------------------------------------------------------
// A chave do Resend vem do ambiente e NUNCA é registrada em log —
// nem em caso de erro. O que vai para a coluna `erro` é a mensagem
// do provedor, que não contém a chave.
//
// A função não aceita "mande este texto para este endereço": ela só
// envia o que já está na fila, montado pelo banco. Assim ninguém
// consegue usá-la para disparar mensagem arbitrária em nome do
// domínio.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const REMETENTE_DOMINIO = "moneynotopo.com.br";
const REMETENTE_CAIXA = "pedidos";
const LOTE = 25;
const MAX_TENTATIVAS = 3;

// ------------------------------------------------------------
// Formatação
// ------------------------------------------------------------
function reais(v: unknown): string {
  const n = Number(v ?? 0);
  return "R$ " + n.toFixed(2).replace(".", ",");
}

/** Escapa o que vem do banco antes de entrar no HTML do e-mail. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * Todo valor que entra no HTML passa por esc() ou por uma conversão
 * explícita. Interpolar direto um campo que pode estar nulo imprime
 * a palavra "undefined" dentro do e-mail do cliente — foi o que o
 * teste pegou com `qtd` ausente.
 */
interface Item {
  nome?: string;
  qtd?: number;
  cor?: string | null;
  tam?: string | null;
  preco?: number;
}

function listaItens(itens: Item[]): string {
  if (!itens?.length) return "";
  const linhas = itens
    .map((i) => {
      const variacao = [i.cor, i.tam].filter(Boolean).join(" · ");
      return `<tr>
        <td style="padding:8px 12px 8px 0;border-bottom:1px solid #f0f0f1;vertical-align:top">
          ${esc(i.nome)}${variacao ? `<br><span style="color:#6b7280;font-size:13px">${esc(variacao)}</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f1;text-align:right;white-space:nowrap;vertical-align:top">
          ${Number(i.qtd ?? 1)}× ${reais(i.preco)}
        </td>
      </tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${linhas}</table>`;
}

// ------------------------------------------------------------
// Os modelos
//
// HTML em tabela e estilo em linha de propósito: cliente de e-mail
// não entende flexbox nem folha de estilo externa. É feio de
// escrever e é o que chega inteiro no Gmail e no Outlook.
// ------------------------------------------------------------
function moldura(titulo: string, corpo: string, rodape: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1117">
  <table style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate">
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 4px;font-size:19px;line-height:1.3">${titulo}</h1>
      ${corpo}
      <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #f0f0f1;color:#6b7280;font-size:13px;line-height:1.5">${rodape}</p>
    </td></tr>
  </table>
</body></html>`;
}

function contatoDaLoja(d: Record<string, unknown>): string {
  const partes: string[] = [];
  if (d.loja_whatsapp) partes.push(`WhatsApp ${esc(d.loja_whatsapp)}`);
  if (d.loja_email) partes.push(esc(d.loja_email));
  return partes.length
    ? `Dúvidas? Fale com a ${esc(d.loja_nome)}: ${partes.join(" · ")}`
    : `Enviado por ${esc(d.loja_nome)}`;
}

function montarHtml(tipo: string, d: Record<string, any>): string {
  const itens = listaItens(d.itens ?? []);
  const totais = `<table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:2px 0;color:#6b7280">Subtotal</td><td style="padding:2px 0;text-align:right">${reais(d.subtotal)}</td></tr>
      <tr><td style="padding:2px 0;color:#6b7280">${d.retirada ? "Retirada na loja" : "Frete"}</td><td style="padding:2px 0;text-align:right">${d.retirada ? "Grátis" : reais(d.frete)}</td></tr>
      <tr><td style="padding:6px 0 0;font-weight:600">Total</td><td style="padding:6px 0 0;text-align:right;font-weight:600">${reais(d.total)}</td></tr>
    </table>`;

  switch (tipo) {
    case "venda_nova":
      return moldura(
        `Venda nova · pedido #${esc(d.numero)}`,
        `<p style="margin:0 0 4px;color:#6b7280;font-size:14px">${esc(d.cliente_nome)} comprou na sua loja.</p>
         ${itens}${totais}
         <p style="margin:16px 0 0;font-size:14px">
           ${d.retirada ? "O cliente vai <strong>retirar na loja</strong>." : "Entrega no endereço informado no pedido."}
           ${d.metodo === "dinheiro" ? " Pagamento em <strong>dinheiro, na retirada</strong>." : ""}
           ${d.metodo === "maquininha" ? " Pagamento na <strong>maquininha, na retirada</strong>." : ""}
         </p>`,
        `Abra o painel para separar o pedido.`,
      );

    case "pedido_recebido":
      return moldura(
        `Pedido #${esc(d.numero)} recebido`,
        `<p style="margin:0 0 4px;color:#6b7280;font-size:14px">A ${esc(d.loja_nome)} recebeu o seu pedido.</p>
         ${itens}${totais}`,
        contatoDaLoja(d),
      );

    case "pagamento_confirmado":
      return moldura(
        `Pagamento confirmado`,
        `<p style="margin:0 0 4px;color:#6b7280;font-size:14px">O pagamento do pedido <strong>#${esc(d.numero)}</strong> foi confirmado. A ${esc(d.loja_nome)} já pode separar.</p>
         ${itens}${totais}`,
        contatoDaLoja(d),
      );

    case "pedido_enviado":
      return moldura(
        `Seu pedido #${esc(d.numero)} foi enviado`,
        `${d.rastreio
            ? `<p style="margin:0 0 12px;font-size:15px">Código de rastreio: <strong style="font-family:ui-monospace,monospace">${esc(d.rastreio)}</strong>${d.transportadora ? `<br><span style="color:#6b7280;font-size:13px">${esc(d.transportadora)}</span>` : ""}</p>`
            : `<p style="margin:0 0 12px;color:#6b7280;font-size:14px">Seu pedido saiu para entrega.</p>`}
         ${itens}`,
        contatoDaLoja(d),
      );

    default:
      return moldura(`Pedido #${esc(d.numero)}`, itens + totais, contatoDaLoja(d));
  }
}

// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) {
    // Não é erro do chamador: é configuração faltando no projeto.
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY não configurada." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: fila, error: erroFila } = await admin
    .from("emails_fila")
    .select("id, tipo, destinatario, assunto, dados, tentativas")
    .eq("status", "pendente")
    .lt("tentativas", MAX_TENTATIVAS)
    .order("created_at", { ascending: true })
    .limit(LOTE);

  if (erroFila) {
    return new Response(JSON.stringify({ error: erroFila.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let enviados = 0;
  let falhas = 0;

  for (const m of fila ?? []) {
    const d = (m.dados ?? {}) as Record<string, any>;

    /* O nome da LOJA aparece como remetente, no endereço da
       plataforma; responder vai direto para a loja. Verificar o
       domínio de cada lojista no Resend seria inviável, e o cliente
       final precisa ver o nome de quem ele comprou — não o nosso. */
    const nomeRemetente = (d.loja_nome ?? "Money NoTopo").toString().replace(/["<>\r\n]/g, "");
    const from = `${nomeRemetente} <${REMETENTE_CAIXA}@${REMETENTE_DOMINIO}>`;

    const corpo: Record<string, unknown> = {
      from,
      to: m.destinatario,
      subject: m.assunto,
      html: montarHtml(m.tipo, d),
    };
    if (d.loja_email) corpo.reply_to = d.loja_email;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
      });

      const resposta = await r.json().catch(() => ({}));

      if (r.ok && resposta?.id) {
        await admin
          .from("emails_fila")
          .update({
            status: "enviado",
            provedor_id: resposta.id,
            enviado_em: new Date().toISOString(),
            tentativas: (m.tentativas ?? 0) + 1,
            erro: null,
          })
          .eq("id", m.id);
        enviados++;
      } else {
        const tentativas = (m.tentativas ?? 0) + 1;
        await admin
          .from("emails_fila")
          .update({
            // Só desiste depois de MAX_TENTATIVAS: instabilidade do
            // provedor não pode condenar a mensagem na primeira.
            status: tentativas >= MAX_TENTATIVAS ? "falhou" : "pendente",
            tentativas,
            erro: String(resposta?.message ?? resposta?.name ?? `HTTP ${r.status}`).slice(0, 500),
          })
          .eq("id", m.id);
        falhas++;
      }
    } catch (e) {
      const tentativas = (m.tentativas ?? 0) + 1;
      await admin
        .from("emails_fila")
        .update({
          status: tentativas >= MAX_TENTATIVAS ? "falhou" : "pendente",
          tentativas,
          erro: String(e).slice(0, 500),
        })
        .eq("id", m.id);
      falhas++;
    }
  }

  return new Response(
    JSON.stringify({ processados: fila?.length ?? 0, enviados, falhas }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

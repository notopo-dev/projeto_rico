// ============================================================
// _shared/limite.ts
//
// Limite de requisições para as funções que ficam abertas sem login.
//
// Três funções desta pasta respondem a qualquer pessoa na internet:
// cotar frete (gasta a cota do Melhor Envio do lojista), rastrear
// (consulta identidade por CPF + telefone) e criar cobrança (mexe na
// conta Stripe do lojista). Sem limite, todas rodam em laço.
//
// O contador fica no banco (22_rate_limit.sql), não em memória: Edge
// Function não guarda estado entre chamadas e cada invocação pode cair
// numa máquina diferente. Contador em memória não conta nada.
// ============================================================

/**
 * Identifica quem está chamando.
 *
 * Não é à prova de fraude — IP se troca. Serve para conter laço
 * automatizado, que é o ataque barato, e não para bloquear alguém
 * determinado.
 */
export function origemDaChamada(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for") ?? "";
  const ip = encaminhado.split(",")[0]?.trim();
  return ip || req.headers.get("cf-connecting-ip") || "desconhecido";
}

/**
 * Devolve true quando a chamada pode seguir.
 *
 * Em caso de erro no banco, DEIXA PASSAR de propósito: um problema no
 * contador não pode derrubar o checkout de quem está comprando. Um
 * limite é proteção contra abuso, não um portão de segurança — o que
 * protege de verdade é a validação que vem depois.
 */
export async function dentroDoLimite(
  admin: any,
  chave: string,
  max: number,
  segundos: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("consumir_limite", {
      p_chave: chave,
      p_max: max,
      p_segundos: segundos,
    });
    if (error) {
      console.error("rate limit indisponivel:", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("rate limit falhou:", e);
    return true;
  }
}

export function respostaLimite(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Muitas tentativas. Aguarde um minuto e tente de novo.",
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Mensalidade da loja com a plataforma.
 *
 * ----------------------------------------------------------------
 * Quem decide se a loja pode operar é o BANCO
 * ----------------------------------------------------------------
 * Tem uma função só no banco — `loja_pode_operar` — e é ela que
 * responde. Este arquivo chama e obedece; não refaz a conta em
 * TypeScript.
 *
 * Isso não é preciosismo. A mesma pergunta é feita em três lugares
 * (esta tela, o gatilho que cria pedido e a política que mostra a
 * loja na vitrine). Três cópias da regra viram três respostas
 * diferentes no dia em que uma mudar.
 *
 * E o mais importante: a resposta daqui é só para DESENHAR a tela.
 * Quem impede de verdade é o gatilho no banco. Se alguém forjar o
 * retorno desta função no navegador, continua sem conseguir criar
 * um pedido.
 */

export type SituacaoAssinatura =
  | "teste"
  | "expirada"
  | "ativa"
  | "inadimplente"
  | "cancelada"
  | "sem_assinatura";

export interface EstadoAssinatura {
  situacao: SituacaoAssinatura;
  /** Resposta do banco, não desta tela. */
  podeUsar: boolean;
  /** Loja de cortesia (demo, interna). Não vê cobrança. */
  isenta: boolean;
  /** Horas inteiras que faltam do teste. null quando não está em teste. */
  horasDeTeste: number | null;
  proximaCobranca: string | null;
  temAssinatura: boolean;
}

interface LinhaLoja {
  assinatura_status: SituacaoAssinatura | null;
  teste_termina_em: string | null;
  assinatura_proxima_cobranca: string | null;
  stripe_subscription_id: string | null;
  isenta_de_mensalidade: boolean | null;
}

export async function lerAssinatura(): Promise<EstadoAssinatura> {
  const storeId = await getCurrentStoreId();

  // As duas perguntas vão juntas: a linha é para mostrar, a função
  // é para decidir.
  const [linha, decisao] = await Promise.all([
    supabase
      .from("stores")
      .select(
        "assinatura_status, teste_termina_em, assinatura_proxima_cobranca, " +
          "stripe_subscription_id, isenta_de_mensalidade",
      )
      .eq("id", storeId)
      .single(),
    supabase.rpc("loja_pode_operar", { p_store_id: storeId }),
  ]);

  if (linha.error) throw linha.error;
  if (decisao.error) throw decisao.error;

  // Duplo `as`: o cliente não tem os tipos do banco gerados, então
  // ele devolve um tipo largo. O formato de verdade é o LinhaLoja
  // acima, que é exatamente a lista do select.
  const l = linha.data as unknown as LinhaLoja;

  let horas: number | null = null;
  if (l.assinatura_status === "teste" && l.teste_termina_em) {
    const falta = new Date(l.teste_termina_em).getTime() - Date.now();
    // Arredonda para cima: faltando 1h10, o lojista lê "2 horas" e
    // não "1". Prometer menos tempo do que existe é melhor do que
    // prometer mais.
    horas = falta > 0 ? Math.ceil(falta / 3_600_000) : 0;
  }

  return {
    situacao: l.assinatura_status ?? "sem_assinatura",
    podeUsar: decisao.data === true,
    isenta: l.isenta_de_mensalidade === true,
    horasDeTeste: horas,
    proximaCobranca: l.assinatura_proxima_cobranca,
    temAssinatura: Boolean(l.stripe_subscription_id),
  };
}

/**
 * Chama uma Edge Function e devolve o corpo mesmo quando dá erro.
 *
 * `supabase.functions.invoke` descarta o corpo fora do 2xx — o
 * lojista via "non-2xx status code" no lugar do motivo real. Mesmo
 * padrão já usado no checkout da loja e no cálculo de frete.
 */
async function chamar<T>(nome: string, corpo?: unknown): Promise<T> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const res = await fetch(`${url}/functions/v1/${nome}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo ?? {}),
  });

  let dados: any = null;
  try {
    dados = await res.json();
  } catch {
    dados = null;
  }

  if (!res.ok || dados?.error) {
    throw new Error(dados?.error ?? `Erro inesperado (status ${res.status}).`);
  }
  return dados as T;
}

export interface CartaoPreparado {
  clientSecret: string;
  publishableKey: string;
}

export function prepararCartao(): Promise<CartaoPreparado> {
  return chamar<CartaoPreparado>("stripe-assinatura-iniciar");
}

export interface ResultadoAssinatura {
  subscription_id: string;
  status: string;
  em_teste?: boolean;
  proxima_cobranca: string | null;
  /** O banco do lojista pediu autenticação; a tela termina. */
  precisa_autenticar?: boolean;
  client_secret?: string | null;
  ja_existia?: boolean;
}

export function assinar(setupIntentId: string): Promise<ResultadoAssinatura> {
  // Só o id do SetupIntent sobe. Preço, plano e loja são decididos
  // no servidor — de propósito.
  return chamar<ResultadoAssinatura>("stripe-assinatura-ativar", {
    setup_intent_id: setupIntentId,
  });
}

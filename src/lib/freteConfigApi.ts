import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Configuração de frete da loja.
 *
 * Duas coisas moram aqui, e é bom não confundir:
 *
 *  - As REGRAS (modo, valor fixo, frete grátis, retirada) ficam em
 *    `stores`, porque a loja pública precisa lê-las sem login para
 *    montar as opções no checkout. Não são segredo: é preço de frete.
 *
 *  - O TOKEN do Melhor Envio fica em `store_settings`, que o RLS abre
 *    só para o dono da loja. Esse token gasta dinheiro — compra
 *    etiqueta com o saldo da conta — e nunca pode chegar ao navegador
 *    de quem está comprando.
 */

export type FreteModo = "melhor_envio" | "fixo" | "combinar";
export type MelhorEnvioAmbiente = "sandbox" | "producao";

export interface RegrasFrete {
  frete_modo: FreteModo;
  frete_fixo: number | null;
  frete_fixo_prazo_dias: number | null;
  frete_fixo_nome: string | null;
  frete_gratis_acima: number | null;
  retirada_na_loja: boolean;
  retirada_instrucoes: string | null;
}

export interface ConfigFrete extends RegrasFrete {
  /** Sem CEP de origem o Melhor Envio não cota nada. */
  cep_origem: string | null;
  /** O token em si nunca sai do banco para a tela — só se existe. */
  tem_token: boolean;
  melhor_envio_ambiente: MelhorEnvioAmbiente;
  /**
   * Produtos ativos sem peso ou medidas. O Melhor Envio recusa o
   * carrinho inteiro por causa de um só, e quem descobre é o cliente,
   * no meio do checkout. Melhor o lojista ver antes.
   */
  produtos_sem_medidas: { id: string; nome: string }[];
}

const CAMPOS_REGRAS =
  "frete_modo, frete_fixo, frete_fixo_prazo_dias, frete_fixo_nome, frete_gratis_acima, retirada_na_loja, retirada_instrucoes";

function semMedidas(p: {
  peso_gramas: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
}) {
  // Mesma regra da função frete-calcular: zero conta como não
  // preenchido, porque caixa de 0cm não existe. Se as duas regras
  // divergirem, o painel diz "tudo certo" e o checkout quebra.
  return (
    !p.peso_gramas || !p.altura_cm || !p.largura_cm || !p.comprimento_cm
  );
}

export async function getConfigFrete(): Promise<ConfigFrete> {
  const storeId = await getCurrentStoreId();

  const [loja, settings, produtos] = await Promise.all([
    supabase
      .from("stores")
      .select(`${CAMPOS_REGRAS}, cep_origem`)
      .eq("id", storeId)
      .single(),
    supabase
      .from("store_settings")
      .select("melhor_envio_token, melhor_envio_ambiente")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id, nome, peso_gramas, altura_cm, largura_cm, comprimento_cm")
      .eq("store_id", storeId)
      .eq("status", "ativo"),
  ]);

  if (loja.error) throw loja.error;
  if (produtos.error) throw produtos.error;

  const s: any = loja.data;

  return {
    frete_modo: (s.frete_modo ?? "combinar") as FreteModo,
    frete_fixo: s.frete_fixo === null ? null : Number(s.frete_fixo),
    frete_fixo_prazo_dias: s.frete_fixo_prazo_dias ?? null,
    frete_fixo_nome: s.frete_fixo_nome ?? null,
    frete_gratis_acima:
      s.frete_gratis_acima === null ? null : Number(s.frete_gratis_acima),
    retirada_na_loja: Boolean(s.retirada_na_loja),
    retirada_instrucoes: s.retirada_instrucoes ?? null,
    cep_origem: s.cep_origem ?? null,
    tem_token: Boolean(settings.data?.melhor_envio_token),
    melhor_envio_ambiente:
      settings.data?.melhor_envio_ambiente === "producao"
        ? "producao"
        : "sandbox",
    produtos_sem_medidas: (produtos.data ?? [])
      .filter(semMedidas)
      .map((p: any) => ({ id: p.id, nome: p.nome })),
  };
}

export async function salvarRegrasFrete(regras: RegrasFrete): Promise<void> {
  if (regras.frete_modo === "fixo") {
    if (regras.frete_fixo === null || regras.frete_fixo < 0) {
      throw new Error("Informe o valor do frete fixo.");
    }
  }
  if (regras.frete_gratis_acima !== null && regras.frete_gratis_acima <= 0) {
    throw new Error("O valor para frete grátis precisa ser maior que zero.");
  }

  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("stores")
    .update({
      frete_modo: regras.frete_modo,
      // Guarda só o que o modo escolhido usa. Deixar valor de um modo
      // que não está ligado é o tipo de resto que depois ninguém sabe
      // se está valendo ou não.
      frete_fixo: regras.frete_modo === "fixo" ? regras.frete_fixo : null,
      frete_fixo_prazo_dias:
        regras.frete_modo === "fixo" ? regras.frete_fixo_prazo_dias : null,
      frete_fixo_nome:
        regras.frete_modo === "fixo"
          ? regras.frete_fixo_nome?.trim() || null
          : null,
      frete_gratis_acima: regras.frete_gratis_acima,
      retirada_na_loja: regras.retirada_na_loja,
      retirada_instrucoes: regras.retirada_na_loja
        ? regras.retirada_instrucoes?.trim() || null
        : null,
    })
    .eq("id", storeId);

  if (error) throw error;
}

/**
 * Salva o token do Melhor Envio.
 *
 * `token` em branco mantém o que já está gravado — a tela nunca recebe
 * o token de volta, então campo vazio significa "não mexi nisso", e
 * não "apague". Para apagar existe `desconectarMelhorEnvio`.
 */
export async function salvarMelhorEnvio(
  token: string,
  ambiente: MelhorEnvioAmbiente,
): Promise<void> {
  const storeId = await getCurrentStoreId();

  const mudancas: Record<string, unknown> = {
    melhor_envio_ambiente: ambiente,
  };

  const limpo = token.trim();
  if (limpo) mudancas.melhor_envio_token = limpo;

  const { error } = await supabase
    .from("store_settings")
    .update(mudancas)
    .eq("store_id", storeId);

  if (error) throw error;
}

export async function desconectarMelhorEnvio(): Promise<void> {
  const storeId = await getCurrentStoreId();

  const { error } = await supabase
    .from("store_settings")
    .update({ melhor_envio_token: null })
    .eq("store_id", storeId);

  if (error) throw error;
}

export interface TesteMelhorEnvio {
  conectado: boolean;
  ambiente: MelhorEnvioAmbiente;
  nome?: string;
  email?: string | null;
  saldo?: number | null;
  temCepOrigem?: boolean;
  motivo?: "sem_token" | "token_recusado" | "indisponivel";
  mensagem?: string;
}

/**
 * Bate na API do Melhor Envio com o token gravado e conta o que
 * aconteceu. `invoke` não serve aqui: em resposta que não é 2xx ele
 * joga o corpo fora, e o corpo é justamente a explicação do erro.
 */
export async function testarMelhorEnvio(): Promise<TesteMelhorEnvio> {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/frete-status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(
      corpo?.error ?? `Não foi possível testar a conexão (status ${res.status}).`,
    );
  }

  return corpo as TesteMelhorEnvio;
}

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
 *  - A CONEXÃO com o Melhor Envio fica em `store_settings`, que o RLS
 *    abre só para o dono da loja. Esses tokens gastam dinheiro —
 *    compram etiqueta com o saldo da conta — e nunca podem chegar ao
 *    navegador de quem está comprando.
 *
 * Sobre a conexão: o Melhor Envio tirou os tokens pessoais do painel.
 * Hoje não existe nada para o lojista copiar e colar — ele autoriza a
 * plataforma numa tela deles e o token vem pelo servidor. Por isso
 * nada aqui recebe ou devolve token: a tela só sabe se está conectada.
 */

export type FreteModo = "melhor_envio" | "fixo" | "combinar";

export interface RegrasFrete {
  frete_modo: FreteModo;
  frete_fixo: number | null;
  frete_fixo_prazo_dias: number | null;
  frete_fixo_nome: string | null;
  frete_gratis_acima: number | null;
  retirada_na_loja: boolean;
  retirada_instrucoes: string | null;
  /**
   * Pagar no balcão, na hora de buscar.
   *
   * Só valem na retirada: na entrega não há ninguém da loja para
   * receber. Nascem desligadas — a loja escolhe se quer.
   */
  retirada_aceita_dinheiro: boolean;
  retirada_aceita_maquininha: boolean;
}

export interface ConfigFrete extends RegrasFrete {
  /** Sem CEP de origem o Melhor Envio não cota nada. */
  cep_origem: string | null;
  /** Os tokens nunca saem do banco para a tela — só se existem. */
  conectado: boolean;
  /** Nome da conta autorizada, só para a tela mostrar quem está ligado. */
  conta: string | null;
  /** Validade do acesso. Renovado sozinho antes de vencer. */
  expira_em: string | null;
  /**
   * Produtos ativos sem peso ou medidas. O Melhor Envio recusa o
   * carrinho inteiro por causa de um só, e quem descobre é o cliente,
   * no meio do checkout. Melhor o lojista ver antes.
   */
  produtos_sem_medidas: { id: string; nome: string }[];
}

const CAMPOS_REGRAS =
  "frete_modo, frete_fixo, frete_fixo_prazo_dias, frete_fixo_nome, frete_gratis_acima, retirada_na_loja, retirada_instrucoes, retirada_aceita_dinheiro, retirada_aceita_maquininha";

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

  const [loja, settings, conectado, produtos] = await Promise.all([
    supabase
      .from("stores")
      .select(`${CAMPOS_REGRAS}, cep_origem`)
      .eq("id", storeId)
      .single(),
    // Nunca seleciona melhor_envio_token: ele compra etiqueta com o
    // saldo do lojista e não tem por que existir dentro do navegador.
    // A função no banco responde só sim ou não.
    supabase
      .from("store_settings")
      .select("melhor_envio_conta, melhor_envio_expira_em")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase.rpc("melhor_envio_conectado"),
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
    retirada_aceita_dinheiro: Boolean(s.retirada_aceita_dinheiro),
    retirada_aceita_maquininha: Boolean(s.retirada_aceita_maquininha),
    cep_origem: s.cep_origem ?? null,
    conectado: conectado.data === true,
    conta: settings.data?.melhor_envio_conta ?? null,
    expira_em: settings.data?.melhor_envio_expira_em ?? null,
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
      // Desligar a retirada desliga as formas junto. Senão ficariam
      // ligadas e invisíveis, e voltariam sozinhas no dia em que a
      // loja religasse a retirada — oferecendo pagamento no balcão
      // sem ninguém ter pedido.
      retirada_aceita_dinheiro:
        regras.retirada_na_loja && regras.retirada_aceita_dinheiro,
      retirada_aceita_maquininha:
        regras.retirada_na_loja && regras.retirada_aceita_maquininha,
    })
    .eq("id", storeId);

  if (error) throw error;
}

/**
 * Fala com a função frete-conectar.
 *
 * `fetch` e não `invoke`: em resposta que não é 2xx o invoke joga o
 * corpo fora, e o corpo é justamente a explicação do erro.
 */
async function chamarConectar(corpo: Record<string, unknown>) {
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre de novo.");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/frete-conectar`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpo),
    },
  );

  let dados: any = null;
  try {
    dados = await res.json();
  } catch {
    dados = null;
  }

  if (!res.ok || dados?.error) {
    throw new Error(dados?.error ?? `Erro na conexão (status ${res.status}).`);
  }

  return dados;
}

/** Devolve a URL para onde mandar o lojista autorizar. */
export async function iniciarConexao(): Promise<string> {
  const dados = await chamarConectar({ acao: "iniciar" });
  if (!dados?.url) throw new Error("Não foi possível iniciar a conexão.");
  return dados.url as string;
}

/** Recebe o código da volta e o troca por um acesso válido. */
export async function concluirConexao(
  code: string,
  state: string,
): Promise<{ conta: string | null }> {
  const dados = await chamarConectar({ acao: "concluir", code, state });
  return { conta: dados?.conta ?? null };
}

export async function desconectarMelhorEnvio(): Promise<void> {
  await chamarConectar({ acao: "desconectar" });
}

export interface TesteMelhorEnvio {
  conectado: boolean;
  nome?: string;
  email?: string | null;
  saldo?: number | null;
  temCepOrigem?: boolean;
  expiraEm?: string | null;
  precisaConectar?: boolean;
  mensagem?: string;
}

/**
 * Bate na API do Melhor Envio com o acesso gravado e conta o que
 * aconteceu — passando pelo mesmo caminho que o checkout usa, para o
 * teste provar alguma coisa.
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

import { supabase } from "./supabaseClient";

export interface EnderecoStripe {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: "BR";
}

export interface DadosPessoaFisica {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: { day: number; month: number; year: number };
  address: EnderecoStripe;
  tax_id_individual: string;
  political_exposure?: "existing" | "none";
}

export interface DadosPessoaJuridica {
  name: string;
  tax_id: string;
  phone: string;
  address: EnderecoStripe;
  representative: DadosPessoaFisica;
}

export interface DadosContaBancaria {
  account_holder_name: string;
  account_number: string;
  routing_number: string;
}

export interface CriarContaCustomInput {
  tipoPessoa: "individual" | "company";
  individual?: DadosPessoaFisica;
  company?: DadosPessoaJuridica;
  contaBancaria?: DadosContaBancaria;
}

export interface StatusContaCustom {
  accountId: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requisitos_pendentes: string[];
}

export async function salvarDadosStripeCustom(
  input: CriarContaCustomInput,
): Promise<StatusContaCustom> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/stripe-custom-create-account`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok) {
    throw new Error(
      corpo?.error ?? `Erro ao salvar dados (status ${res.status}).`,
    );
  }

  if (corpo?.error) {
    throw new Error(corpo.error);
  }

  return corpo as StatusContaCustom;
}

/**
 * Envia o documento de identidade. Em modo de teste, pode enviar
 * um token mágico da Stripe (ex: file_identity_document_success)
 * em vez de um arquivo real, passando testToken.
 */
export async function enviarDocumentoIdentidade(
  file: File | null,
  side: "front" | "back",
  testToken?: string,
): Promise<void> {
  const formData = new FormData();
  if (testToken) {
    formData.append("test_token", testToken);
  } else if (file) {
    formData.append("file", file);
  } else {
    throw new Error("Nenhum documento informado.");
  }
  formData.append("side", side);

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(
    `${supabaseUrl}/functions/v1/stripe-custom-upload-document`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
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
      corpo?.error ?? `Erro ao enviar documento (status ${res.status}).`,
    );
  }
}

export interface RequisitoPendente {
  campo: string | null;
  motivo: string | null;
}

export interface EnderecoSalvo {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface StatusCompletoStripe {
  situacao:
    | "nao_iniciado"
    | "incompleto"
    | "em_analise"
    | "pendencias"
    | "ativo";
  accountId?: string;
  tipoPessoa?: "individual" | "company" | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  /**
   * Formas de pagamento da loja.
   *
   * "liberado" é o que a Stripe permite para esta conta; "aceita" é o
   * que o lojista escolheu oferecer. O checkout só mostra a forma
   * quando os dois são verdade — daí serem dois campos e não um.
   */
  metodos?: {
    cartao: { liberado: boolean; aceita: boolean };
    pix: { liberado: boolean; aceita: boolean };
  };
  /**
   * Carteiras digitais (Apple Pay, Google Pay).
   *
   * Não são formas de pagamento separadas — são maneiras de entregar
   * um cartão. Só dependem do domínio da loja estar registrado na
   * conta conectada; por isso não têm interruptor de "aceita".
   */
  carteiras?: {
    dominioRegistrado: string | null;
    ativas: boolean;
  };
  requisitos?: RequisitoPendente[];
  documento_enviado?: boolean;
  dados?: {
    individual: {
      nome: string | null;
      sobrenome: string | null;
      email: string | null;
      telefone: string | null;
      endereco: EnderecoSalvo | null;
    } | null;
    empresa: {
      razao_social: string | null;
      telefone: string | null;
      endereco: EnderecoSalvo | null;
    } | null;
    conta_bancaria: {
      banco_nome: string | null;
      ultimos_digitos: string | null;
      agencia: string | null;
      titular: string | null;
    } | null;
  };
}

/**
 * Consulta o estado real da conta Connect na Stripe, com os
 * dados já preenchidos e o que ainda falta. Usado para o
 * lojista ver a situação, retomar de onde parou e editar.
 */
export async function consultarStatusStripe(): Promise<StatusCompletoStripe> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-custom-status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(
      corpo?.error ?? `Erro ao consultar status (status ${res.status}).`,
    );
  }

  return corpo as StatusCompletoStripe;
}
/**
 * Liga ou desliga uma forma de pagamento da loja.
 *
 * Só mexe na vontade do lojista. Se a Stripe não tiver liberado
 * aquele meio para a conta, ligar aqui não faz o checkout oferecer —
 * quem responde por isso é a `stripe-create-payment-intent`, que
 * confere os dois antes de criar a cobrança.
 */
export async function salvarFormaPagamento(
  forma: "pix" | "cartao",
  ativo: boolean,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("Sessão expirada. Entre novamente.");

  const coluna = forma === "pix" ? "aceita_pix" : "aceita_cartao";

  const { error } = await supabase
    .from("stores")
    .update({ [coluna]: ativo })
    .eq("owner_id", user.id);

  if (error) throw error;
}

export interface ResultadoCarteiras {
  sucesso: boolean;
  dominio: string;
  jaExistia: boolean;
  applePay: string | null;
  googlePay: string | null;
}

/**
 * Registra o domínio da loja na conta conectada, que é o que libera
 * os botões de Apple Pay e Google Pay no checkout.
 *
 * O domínio não vai daqui: quem decide é o servidor, a partir do
 * APP_URL. Mandar do navegador deixaria um lojista registrar o
 * domínio de outra pessoa.
 */
export async function ativarCarteirasDigitais(): Promise<ResultadoCarteiras> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const url = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${url}/functions/v1/stripe-registrar-dominio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(
      corpo?.error ?? `Falha ao ativar as carteiras (${res.status}).`,
    );
  }

  return corpo as ResultadoCarteiras;
}

export interface ResultadoPix {
  sucesso: boolean;
  via: "v1" | "v2" | "ja_estava_ativa";
  status: string | null;
}

/**
 * Pede a liberação do Pix para a conta de recebimento da loja.
 *
 * Confirmado em 30/09/2026 numa conta real: a capacidade existe e a
 * liberação sai NA HORA, sem documento novo. O provedor recusa o
 * pedido pela API nova ("did you mean fpx_payments...?") e aceita
 * pela antiga — a função do servidor tenta as duas, nessa ordem.
 *
 * ATENÇÃO: não tem volta. A documentação do provedor diz que algumas
 * capacidades, uma vez pedidas, ficam permanentes. Por isso a tela
 * pergunta antes, e esta função nunca é chamada sozinha.
 */
export async function ativarPix(): Promise<ResultadoPix> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const url = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${url}/functions/v1/stripe-pix-ativar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const corpo = await res.json().catch(() => null);
  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? "Não foi possível liberar o Pix.");
  }
  return corpo as ResultadoPix;
}

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
  aceiteTermos?: boolean;
}

export interface StatusContaCustom {
  accountId: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requisitos_pendentes: string[];
}

export async function salvarDadosStripeCustom(
  input: CriarContaCustomInput
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
    }
  );

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok) {
    throw new Error(
      corpo?.error ?? `Erro ao salvar dados (status ${res.status}).`
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
  testToken?: string
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
    }
  );

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Erro ao enviar documento (status ${res.status}).`);
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
    throw new Error(corpo?.error ?? `Erro ao consultar status (status ${res.status}).`);
  }

  return corpo as StatusCompletoStripe;
}
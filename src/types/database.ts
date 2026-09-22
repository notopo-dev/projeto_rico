// ============================================================
// Tipos que espelham o schema SQL do Supabase.
// Mantenha sincronizado com as migrations sempre que alterar
// uma tabela.
// ============================================================

export type OrderStatus = "pendente" | "pago" | "enviado" | "entregue" | "cancelado";
export type ProductStatus = "ativo" | "inativo" | "sem_estoque";
export type CustomerStatus = "ativo" | "inativo";
export type PaymentMethod = "pix" | "cartao" | "boleto" | "cartao_stripe";
export type PaymentStatus = "recebido" | "pendente" | "estornado" | "falhou";
export type EtiquetaStatus =
  | "pendente"
  | "paga"
  | "gerada"
  | "postada"
  | "entregue"
  | "cancelada";

export interface Store {
  id: string;
  owner_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  email: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  banner_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  politica_troca: string | null;
  politica_frete: string | null;
  ativo: boolean;
  manter_estoque: boolean;
  exibir_sem_estoque: boolean;
  modo_compra: "whatsapp" | "pagamento" | "ambos";
  plano: string;
  plano_renovacao: string | null;
  // Endereço de origem (de onde a encomenda é postada)
  cep_origem: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  // Stripe Connect (conta do lojista, recebe do cliente final)
  stripe_account_id: string | null;
  stripe_tipo_pessoa: "individual" | "company" | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_onboarding_completo: boolean;
  stripe_documento_enviado: boolean;
  stripe_requisitos_pendentes: unknown[] | null;
  // Stripe Billing (mensalidade do lojista com a plataforma)
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  assinatura_status:
    | "sem_assinatura"
    | "ativa"
    | "inadimplente"
    | "cancelada"
    | null;
  assinatura_proxima_cobranca: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  store_id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  nome: string;
  slug: string;
  descricao: string | null;
  sku: string;
  preco: number;
  preco_promocional: number | null;
  estoque: number;
  estoque_minimo: number;
  permite_venda_sem_estoque: boolean;
  item_promocao: boolean;
  status: ProductStatus;
  // Dimensões para cálculo de frete
  peso_gramas: number | null;
  altura_cm: number | null;
  largura_cm: number | null;
  comprimento_cm: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductColor {
  id: string;
  product_id: string;
  nome: string;
  codigo_hex: string | null;
  imagem_url: string | null;
  created_at?: string;
}

export interface ProductSize {
  id: string;
  product_id: string;
  tamanho: string;
  created_at?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  posicao: number;
  created_at: string;
}

export interface Customer {
  id: string;
  store_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string | null;
  numero: string;
  status: OrderStatus;
  metodo_pagamento: PaymentMethod | null;
  subtotal: number;
  frete: number;
  total: number;
  endereco_entrega: Record<string, unknown> | null;
  // Dados de envio
  frete_servico: string | null;
  frete_transportadora: string | null;
  frete_prazo_dias: number | null;
  cep_entrega: string | null;
  melhor_envio_order_id: string | null;
  codigo_rastreio: string | null;
  etiqueta_url: string | null;
  etiqueta_status: EtiquetaStatus | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  cor_selecionada: string | null;
  tamanho_selecionado: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  store_id: string;
  order_id: string;
  transacao_id: string;
  metodo: PaymentMethod;
  valor_bruto: number;
  taxa: number;
  valor_liquido: number | null;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreSettings {
  store_id: string;
  notif_novo_pedido: boolean;
  notif_pedido_cancelado: boolean;
  notif_estoque_minimo: boolean;
  notif_novo_cliente: boolean;
  notif_relatorio_semanal: boolean;
  notif_marketing: boolean;
  melhor_envio_token: string | null;
  melhor_envio_ambiente: "sandbox" | "producao";
  correios_login: string | null;
  pix_chave: string | null;
  mercado_pago_token: string | null;
  updated_at: string;
}
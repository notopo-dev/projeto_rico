// ============================================================
// Tipos que espelham o schema SQL do Supabase.
// Mantenha sincronizado com 01_schema.sql sempre que alterar
// uma tabela.
// ============================================================

export type OrderStatus = "pendente" | "pago" | "enviado" | "entregue" | "cancelado";
export type ProductStatus = "ativo" | "inativo" | "sem_estoque";
export type CustomerStatus = "ativo" | "inativo";
export type PaymentMethod = "pix" | "cartao" | "boleto";
export type PaymentStatus = "recebido" | "pendente" | "estornado" | "falhou";
export type WhatsAppGatilho =
  | "pedido_confirmado"
  | "pagamento_recebido"
  | "pedido_enviado"
  | "pedido_entregue"
  | "pedido_cancelado"
  | "pagamento_pendente"
  | "carrinho_abandonado";

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
  politica_troca: string | null;
  politica_frete: string | null;
  ativo: boolean;
  manter_estoque: boolean;
  exibir_sem_estoque: boolean;
  plano: string;
  plano_renovacao: string | null;
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
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  posicao: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  nome: string;
  sku: string | null;
  preco: number | null;
  estoque: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  store_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
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
  created_at: string;
  updated_at: string;
}

export interface WhatsAppRule {
  id: string;
  store_id: string;
  nome: string;
  gatilho: WhatsAppGatilho;
  mensagem: string;
  ativa: boolean;
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
  correios_login: string | null;
  pix_chave: string | null;
  mercado_pago_token: string | null;
  stripe_secret_key: string | null;
  updated_at: string;
}

// Linha da view v_estoque (criada em 03_functions.sql)
export interface EstoqueView {
  id: string;
  store_id: string;
  nome: string;
  sku: string;
  categoria: string | null;
  estoque: number;
  estoque_minimo: number;
  status_estoque: "ok" | "baixo" | "sem";
}

// Tipagem completa das tabelas para uso com createClient<Database>()
export interface Database {
  public: {
    Tables: {
      stores: { Row: Store; Insert: Partial<Store>; Update: Partial<Store> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      product_images: { Row: ProductImage; Insert: Partial<ProductImage>; Update: Partial<ProductImage> };
      product_variants: { Row: ProductVariant; Insert: Partial<ProductVariant>; Update: Partial<ProductVariant> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem> };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> };
      whatsapp_rules: { Row: WhatsAppRule; Insert: Partial<WhatsAppRule>; Update: Partial<WhatsAppRule> };
      store_settings: { Row: StoreSettings; Insert: Partial<StoreSettings>; Update: Partial<StoreSettings> };
    };
    Views: {
      v_estoque: { Row: EstoqueView };
    };
  };
}
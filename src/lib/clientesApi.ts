import { supabase } from "./supabaseClient";
import { getCurrentStoreId } from "./currentStore";

/**
 * Clientes da loja.
 *
 * Esta tela tinha `const customers = []` escrito no código — filtrava
 * e pesquisava dentro de uma lista vazia por construção. O mesmo que
 * acontecia em Pedidos.
 *
 * O isolamento entre lojas é do RLS (03_rls_relatorios.sql): customers
 * é a tabela mais sensível do sistema, com telefone, e-mail e CPF.
 * O filtro por store_id aqui é conveniência; quem recusa é o banco.
 */

export interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  status: "ativo" | "inativo";
  criado_em: string;

  /** Pedidos que contam como venda (fora cancelados e devolvidos). */
  pedidos: number;
  /** Quanto o cliente já deixou na loja, descontadas as devoluções. */
  gasto: number;
  ultima_compra: string | null;
}

/** Status de pedido que não contam como compra. */
const NAO_CONTAM = ["cancelado", "devolvido"];

export async function listarClientes(): Promise<Cliente[]> {
  const storeId = await getCurrentStoreId();

  // O join traz os pedidos de cada cliente numa consulta só. Somar no
  // navegador é aceitável aqui: a lista é a dos clientes de UMA loja,
  // não do sistema inteiro.
  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id, nome, email, telefone, cpf, status, created_at,
      orders(total, valor_reembolsado, status, created_at)
    `,
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((c: any) => {
    const pedidos = (c.orders ?? []).filter(
      (o: any) => !NAO_CONTAM.includes(o.status),
    );

    const gasto = pedidos.reduce(
      (soma: number, o: any) =>
        soma + (Number(o.total ?? 0) - Number(o.valor_reembolsado ?? 0)),
      0,
    );

    const ultima = pedidos.reduce(
      (maisRecente: string | null, o: any) => {
        if (!maisRecente || o.created_at > maisRecente) return o.created_at;
        return maisRecente;
      },
      null as string | null,
    );

    return {
      id: c.id,
      nome: c.nome,
      email: c.email ?? null,
      telefone: c.telefone ?? null,
      cpf: c.cpf ?? null,
      status: (c.status ?? "ativo") as "ativo" | "inativo",
      criado_em: c.created_at,
      pedidos: pedidos.length,
      gasto,
      ultima_compra: ultima,
    };
  });
}

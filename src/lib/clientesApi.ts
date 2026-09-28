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

/* --------------------------- edição --------------------------- */

export interface DadosCliente {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
}

function digitos(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Corrige o cadastro de um cliente.
 *
 * Por que a edição fica AQUI, no painel, e não no checkout: o checkout
 * roda no navegador de quem está comprando, sem login nenhum. Se ele
 * pudesse regravar um cadastro existente, bastaria saber o telefone de
 * alguém para trocar o CPF dali e passar a enxergar o histórico da
 * vítima em "Meus pedidos". Aqui exige o seu login, e o RLS confere que
 * o cliente é da sua loja antes de deixar gravar.
 */
export async function atualizarCliente(
  clienteId: string,
  dados: DadosCliente,
): Promise<void> {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  const tel = digitos(dados.telefone);
  const cpf = digitos(dados.cpf);

  if (nome.length < 2) {
    throw new Error("O nome não pode ficar em branco.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("Esse e-mail não parece válido.");
  }
  if (tel && (tel.length < 10 || tel.length > 11)) {
    throw new Error("O telefone precisa ter DDD + número (10 ou 11 dígitos).");
  }
  if (cpf && cpf.length !== 11) {
    throw new Error("O CPF precisa ter 11 dígitos.");
  }

  const storeId = await getCurrentStoreId();

  // CPF e telefone são as chaves que o cliente usa para consultar os
  // próprios pedidos na loja. Se dois cadastros da mesma loja ficassem
  // com o mesmo número, a consulta passaria a devolver pedido de gente
  // trocada. Melhor recusar agora e explicar do que deixar acontecer.
  for (const [coluna, valor, rotulo] of [
    ["cpf", cpf, "CPF"],
    ["telefone", tel, "telefone"],
  ] as const) {
    if (!valor) continue;

    const { data: conflito, error: erroConflito } = await supabase
      .from("customers")
      .select("id, nome")
      .eq("store_id", storeId)
      .eq(coluna, valor)
      .neq("id", clienteId)
      .limit(1)
      .maybeSingle();

    if (erroConflito) throw erroConflito;
    if (conflito) {
      throw new Error(
        `Esse ${rotulo} já está no cadastro de ${conflito.nome}. ` +
          `Confira se não são a mesma pessoa cadastrada duas vezes.`,
      );
    }
  }

  const { error } = await supabase
    .from("customers")
    .update({
      nome,
      email: email || null,
      telefone: tel || null,
      cpf: cpf || null,
    })
    .eq("id", clienteId)
    .eq("store_id", storeId);

  if (error) throw error;

  // Os pedidos antigos herdam a identidade corrigida, para o cliente
  // conseguir consultar o histórico inteiro na loja e não só o que veio
  // depois. Só preenche o que está VAZIO — nunca sobrescreve a
  // identidade que a própria compra registrou, que é a prova de quem
  // comprou naquele dia.
  if (cpf) {
    const { error: erroCpf } = await supabase
      .from("orders")
      .update({ cpf_comprador: cpf })
      .eq("customer_id", clienteId)
      .eq("store_id", storeId)
      .is("cpf_comprador", null);
    if (erroCpf) throw erroCpf;
  }

  if (tel) {
    const { error: erroTel } = await supabase
      .from("orders")
      .update({ telefone_comprador: tel })
      .eq("customer_id", clienteId)
      .eq("store_id", storeId)
      .is("telefone_comprador", null);
    if (erroTel) throw erroTel;
  }
}

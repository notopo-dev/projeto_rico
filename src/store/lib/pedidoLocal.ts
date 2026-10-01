/**
 * O resumo do pedido que a pessoa ACABOU de fazer, guardado no
 * aparelho dela.
 *
 * Para que serve: a tela de pedido confirmado mostrar o que foi
 * comprado, para onde vai e quanto ficou — em vez de só o número.
 *
 * Por que no aparelho e não buscando no servidor: a consulta de
 * pedido exige CPF **e** telefone, e é assim de propósito. Uma busca
 * por número seria aberta a qualquer um: os números são sequenciais,
 * então bastaria contar de 1 em 1 para ler nome, endereço e compras
 * dos clientes da loja. Não vou abrir essa porta para melhorar uma
 * tela. O resumo já está no navegador de quem comprou, então é de lá
 * que ele vem.
 *
 * Mesmo desenho do compradorLocal, e pelos mesmos motivos:
 * - uma chave por loja, porque todas as lojas moram no mesmo domínio;
 * - validade curta, pensando em computador compartilhado;
 * - tudo em try/catch, porque em aba anônima só LER o localStorage já
 *   lança erro — e nesse caso a tela cai no modo simples, sem quebrar;
 * - CPF não entra aqui. A tela não precisa dele, então ele não fica
 *   guardado.
 */

const PREFIXO = "lojapro:ultimopedido:v1:";
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
/** Teto de itens gravados. Carrinho gigante não pode estourar a cota. */
const MAX_ITENS = 40;

export interface ItemSalvo {
  nome: string;
  quantidade: number;
  preco: number;
  imagemUrl: string | null;
  variacao: string;
}

export interface EnderecoSalvo {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface PedidoSalvo {
  numero: string;
  /** ISO. Serve para mostrar data e hora do pedido. */
  criadoEm: string;
  /** "pix" | "credito" | "debito" — como o checkout nomeia. */
  metodo: string;
  subtotal: number;
  frete: number;
  total: number;
  /** Fechou sem frete definido, para a loja acertar depois. */
  freteACombinar: boolean;
  entrega: "entrega" | "retirada";
  freteNome: string;
  freteTransportadora: string;
  fretePrazoDias: number | null;
  endereco: EnderecoSalvo | null;
  itens: ItemSalvo[];
}

function chave(storeId: string) {
  return PREFIXO + storeId;
}

/** O que veio do disco não é confiável por tamanho nem por tipo. */
function texto(v: unknown, max = 120) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function numero(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function salvarUltimoPedido(storeId: string, pedido: PedidoSalvo) {
  try {
    window.localStorage.setItem(
      chave(storeId),
      JSON.stringify({
        ...pedido,
        itens: pedido.itens.slice(0, MAX_ITENS),
        salvoEm: Date.now(),
      }),
    );
  } catch {
    // Armazenamento cheio ou bloqueado. A tela mostra o modo simples;
    // uma comodidade não pode fazer barulho depois de a venda ter
    // dado certo.
  }
}

/**
 * Lê o resumo — mas só se for o pedido pedido.
 *
 * O número confere de propósito: sem essa conferência, abrir o
 * endereço de um pedido antigo mostraria o resumo do mais recente, e
 * a pessoa leria valores que não são daquele pedido.
 */
export function lerUltimoPedido(
  storeId: string,
  numeroEsperado: string | null,
): PedidoSalvo | null {
  try {
    const bruto = window.localStorage.getItem(chave(storeId));
    if (!bruto) return null;

    const obj = JSON.parse(bruto);
    if (!obj || typeof obj !== "object") return null;

    const salvoEm = Number(obj.salvoEm);
    if (!Number.isFinite(salvoEm) || Date.now() - salvoEm > VALIDADE_MS) {
      limparUltimoPedido(storeId);
      return null;
    }

    const num = texto(obj.numero, 40);
    if (!num) return null;
    if (numeroEsperado && num !== numeroEsperado) return null;

    const itensBrutos = Array.isArray(obj.itens) ? obj.itens : [];

    return {
      numero: num,
      criadoEm: texto(obj.criadoEm, 40),
      metodo: texto(obj.metodo, 20),
      subtotal: numero(obj.subtotal),
      frete: numero(obj.frete),
      total: numero(obj.total),
      freteACombinar: obj.freteACombinar === true,
      entrega: obj.entrega === "retirada" ? "retirada" : "entrega",
      freteNome: texto(obj.freteNome),
      freteTransportadora: texto(obj.freteTransportadora),
      fretePrazoDias: Number.isFinite(Number(obj.fretePrazoDias))
        ? Number(obj.fretePrazoDias)
        : null,
      endereco:
        obj.endereco && typeof obj.endereco === "object"
          ? {
              logradouro: texto(obj.endereco.logradouro),
              numero: texto(obj.endereco.numero, 20),
              complemento: texto(obj.endereco.complemento),
              bairro: texto(obj.endereco.bairro),
              cidade: texto(obj.endereco.cidade),
              uf: texto(obj.endereco.uf, 2),
              cep: texto(obj.endereco.cep, 20),
            }
          : null,
      itens: itensBrutos.slice(0, MAX_ITENS).map((i: any) => ({
        nome: texto(i?.nome, 160),
        quantidade: Math.max(1, Math.round(numero(i?.quantidade)) || 1),
        preco: numero(i?.preco),
        imagemUrl:
          typeof i?.imagemUrl === "string" ? i.imagemUrl.slice(0, 600) : null,
        variacao: texto(i?.variacao, 80),
      })),
    };
  } catch {
    return null;
  }
}

export function limparUltimoPedido(storeId: string) {
  try {
    window.localStorage.removeItem(chave(storeId));
  } catch {
    /* idem */
  }
}

/**
 * Os dados do comprador guardados NO APARELHO dele.
 *
 * Para que serve: na segunda compra a tela já vem preenchida e a
 * pessoa só confere e confirma, em vez de digitar nome, CPF, telefone
 * e endereço de novo.
 *
 * Por que no aparelho e não no servidor: a ideia natural seria "digitou
 * o CPF, o site busca os dados". Só que essa busca roda sem login
 * nenhum — quem abrisse o checkout poderia ir testando CPF atrás de CPF
 * e colher nome, telefone e ENDEREÇO dos clientes da loja. E CPF no
 * Brasil não é segredo: vaza em lista. Guardando aqui, o dado nunca
 * sai do celular de quem comprou: não existe consulta para atacar, e o
 * pior caso é o próprio aparelho da pessoa.
 *
 * Por isso também:
 * - uma chave por loja, porque todas as lojas moram no mesmo domínio e
 *   os dados de uma não podem aparecer no checkout da outra;
 * - validade de 90 dias, pensando em computador compartilhado;
 * - a tela SEMPRE avisa que preencheu e oferece limpar, para quem
 *   estiver num aparelho emprestado não sair comprando com o cadastro
 *   de outra pessoa.
 *
 * Tudo em try/catch: em aba anônima, ou com o armazenamento bloqueado,
 * só ler o localStorage já lança erro. Nesse caso o checkout segue
 * vazio, como antes — nada quebra.
 */

const PREFIXO = "lojapro:comprador:v1:";
const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;

export interface CompradorSalvo {
  nome: string;
  telefone: string;
  cpf: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const CAMPOS: (keyof CompradorSalvo)[] = [
  "nome",
  "telefone",
  "cpf",
  "email",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
];

function chave(storeId: string) {
  return PREFIXO + storeId;
}

/** Corta valor absurdo: o que veio do disco não é confiável por tamanho. */
function texto(v: unknown) {
  return typeof v === "string" ? v.slice(0, 120) : "";
}

export function lerComprador(storeId: string): CompradorSalvo | null {
  try {
    const bruto = window.localStorage.getItem(chave(storeId));
    if (!bruto) return null;

    const obj = JSON.parse(bruto);
    if (!obj || typeof obj !== "object") return null;

    const salvoEm = Number(obj.salvoEm);
    if (!Number.isFinite(salvoEm) || Date.now() - salvoEm > VALIDADE_MS) {
      limparComprador(storeId);
      return null;
    }

    const dados = {} as CompradorSalvo;
    CAMPOS.forEach((c) => {
      dados[c] = texto(obj[c]);
    });

    // Sem nome nem CPF não adianta preencher nada.
    if (!dados.nome && !dados.cpf) return null;

    return dados;
  } catch {
    return null;
  }
}

export function salvarComprador(storeId: string, dados: CompradorSalvo) {
  try {
    const limpo: Record<string, unknown> = { salvoEm: Date.now() };
    CAMPOS.forEach((c) => {
      limpo[c] = texto(dados[c]);
    });
    window.localStorage.setItem(chave(storeId), JSON.stringify(limpo));
  } catch {
    // Armazenamento cheio ou bloqueado: a compra não pode falhar por
    // causa de uma comodidade.
  }
}

export function limparComprador(storeId: string) {
  try {
    window.localStorage.removeItem(chave(storeId));
  } catch {
    /* idem */
  }
}

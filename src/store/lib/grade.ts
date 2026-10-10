/**
 * A grade de cor e tamanho, do lado do cliente.
 *
 * ----------------------------------------------------------------
 * Por que este arquivo existe
 * ----------------------------------------------------------------
 * A vitrine mostrava cor e tamanho como duas listas soltas, e o
 * estoque era UM número do produto. O cliente escolhia "P preta"
 * sem nenhuma pista de que a P preta tinha acabado — e só descobria
 * no fim do checkout, com o pedido recusado pelo servidor.
 *
 * Agora quem manda é a combinação. Um vestido com 3 cores e 5
 * tamanhos tem 15 gavetas, cada uma com o seu saldo, e a tela
 * mostra qual dá para comprar ANTES de o cliente tentar.
 *
 * ----------------------------------------------------------------
 * Grade incompleta
 * ----------------------------------------------------------------
 * Vermelho pode existir só em P e M. Nenhuma plataforma grande
 * documenta como declarar isso — Shopify, Nuvemshop e os ERPs de
 * confecção materializam o produto cartesiano inteiro e desligam a
 * célula que não existe. Aqui a célula ausente simplesmente não
 * está na tabela, e a tela a mostra riscada: "não existe" e
 * "esgotou" são coisas diferentes para quem está comprando.
 *
 * ----------------------------------------------------------------
 * Funções puras de propósito
 * ----------------------------------------------------------------
 * Nada aqui toca em React nem no Supabase, então dá para testar o
 * comportamento inteiro sem navegador — que foi como os casos de
 * grade incompleta apareceram.
 */

export interface VariacaoPublica {
  id: string;
  cor_nome: string | null;
  cor_hex: string | null;
  cor_imagem_url: string | null;
  tamanho: string | null;
  preco: number | null;
  estoque: number;
}

export interface CorDaGrade {
  nome: string;
  hex: string | null;
  imagem: string | null;
}

/** Compara como o banco compara: sem acento no espaço, sem caixa. */
function chave(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export interface Grade {
  /** Falso quando o produto não tem grade: a tela segue como sempre. */
  usa: boolean;
  cores: CorDaGrade[];
  tamanhos: string[];
  /** A variação daquela combinação, ou null se ela não existe. */
  achar(cor: string | null, tamanho: string | null): VariacaoPublica | null;
  /** Saldo da combinação. null = combinação não existe na grade. */
  estoqueDe(cor: string | null, tamanho: string | null): number | null;
  /** Dá para comprar? Combinação inexistente nunca dá. */
  disponivel(
    cor: string | null,
    tamanho: string | null,
    vendeSemEstoque: boolean
  ): boolean;
  /** Alguma gaveta desta cor tem peça? Serve para apagar a cor inteira. */
  corTemAlgo(cor: string, vendeSemEstoque: boolean): boolean;
  /**
   * O produto inteiro tem alguma coisa à venda?
   *
   * É o que decide a tarja "Esgotado" por cima da foto. Diferente
   * de "a combinação escolhida acabou": com 3 cores, duas esgotadas,
   * o produto continua à venda — quem some é a cor.
   */
  temAlgoAVenda(vendeSemEstoque: boolean): boolean;
  /** O primeiro tamanho comprável desta cor, para já deixar escolhido. */
  primeiroTamanhoBom(cor: string, vendeSemEstoque: boolean): string | null;
  /** A primeira cor comprável, para já deixar escolhida. */
  primeiraCorBoa(vendeSemEstoque: boolean): CorDaGrade | null;
}

export function montarGrade(variacoes: VariacaoPublica[] | null | undefined): Grade {
  const linhas = (variacoes ?? []).filter(Boolean);

  const cores: CorDaGrade[] = [];
  const tamanhos: string[] = [];

  for (const v of linhas) {
    const nome = (v.cor_nome ?? "").trim();
    if (nome && !cores.some((c) => chave(c.nome) === chave(nome))) {
      cores.push({
        nome,
        hex: v.cor_hex ?? null,
        imagem: v.cor_imagem_url ?? null,
      });
    }

    const tam = (v.tamanho ?? "").trim();
    if (tam && !tamanhos.some((t) => chave(t) === chave(tam))) {
      tamanhos.push(tam);
    }
  }

  function achar(cor: string | null, tamanho: string | null) {
    return (
      linhas.find(
        (v) => chave(v.cor_nome) === chave(cor) && chave(v.tamanho) === chave(tamanho)
      ) ?? null
    );
  }

  function estoqueDe(cor: string | null, tamanho: string | null) {
    const v = achar(cor, tamanho);
    return v ? v.estoque : null;
  }

  function disponivel(
    cor: string | null,
    tamanho: string | null,
    vendeSemEstoque: boolean
  ) {
    const saldo = estoqueDe(cor, tamanho);
    // null = a combinação não existe. Nem com "vende sem estoque"
    // ligado dá para vender peça que não está cadastrada.
    if (saldo === null) return false;
    return saldo > 0 || vendeSemEstoque;
  }

  return {
    usa: linhas.length > 0,
    cores,
    tamanhos,
    achar,
    estoqueDe,
    disponivel,

    temAlgoAVenda(vendeSemEstoque) {
      return linhas.some(
        (v) => v.estoque > 0 || vendeSemEstoque
      );
    },

    corTemAlgo(cor, vendeSemEstoque) {
      // Produto só com cor, sem tamanho nenhum: a própria linha decide.
      if (tamanhos.length === 0) return disponivel(cor, null, vendeSemEstoque);
      return tamanhos.some((t) => disponivel(cor, t, vendeSemEstoque));
    },

    primeiroTamanhoBom(cor, vendeSemEstoque) {
      return tamanhos.find((t) => disponivel(cor, t, vendeSemEstoque)) ?? null;
    },

    primeiraCorBoa(vendeSemEstoque) {
      const boa = cores.find((c) =>
        tamanhos.length === 0
          ? disponivel(c.nome, null, vendeSemEstoque)
          : tamanhos.some((t) => disponivel(c.nome, t, vendeSemEstoque))
      );
      // Tudo esgotado: devolve a primeira mesmo assim, para a tela ter
      // o que mostrar em vez de ficar sem cor nenhuma selecionada.
      return boa ?? cores[0] ?? null;
    },
  };
}

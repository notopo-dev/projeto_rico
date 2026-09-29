import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { PublicProduct } from "../lib/storeApi";

export interface CartItem {
  productId: string;
  productSlug: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagemUrl: string | null;
  corSelecionada?: string;
  tamanhoSelecionado?: string;
}

export interface AddItemOptions {
  imagemUrl?: string | null;
  corSelecionada?: string;
  tamanhoSelecionado?: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (
    product: PublicProduct,
    quantidade?: number,
    options?: AddItemOptions
  ) => void;
  /** Recebe a chave da LINHA (chaveItem), não o id do produto. */
  removeItem: (chave: string) => void;
  updateQuantidade: (chave: string, quantidade: number) => void;
  clear: () => void;
  total: number;
  count: number;
}

/**
 * Identifica uma LINHA do carrinho.
 *
 * Existe por causa de um defeito que apagava compra: remover e alterar
 * quantidade procuravam o item só pelo `productId`, enquanto adicionar
 * já tratava cada variação como linha própria. Resultado: quem tinha a
 * mesma camisa em preto e em branco e clicava na lixeira de uma perdia
 * as duas — e mexer no + de uma mexia na outra junto.
 *
 * A chave é derivada do próprio item, de propósito: carrinho que já
 * estava salvo no navegador continua funcionando, sem precisar migrar
 * nada.
 */
export function chaveItem(item: CartItem) {
  return [
    item.productId,
    item.corSelecionada ?? "",
    item.tamanhoSelecionado ?? "",
  ].join("|");
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(storeSlug: string) {
  return `cart:${storeSlug}`;
}

/**
 * Duas variações do mesmo produto (cores/tamanhos diferentes) são
 * itens distintos no carrinho — não devem ser somadas juntas.
 */
function mesmaVariacao(a: CartItem, productId: string, options?: AddItemOptions) {
  return (
    a.productId === productId &&
    (a.corSelecionada ?? "") === (options?.corSelecionada ?? "") &&
    (a.tamanhoSelecionado ?? "") === (options?.tamanhoSelecionado ?? "")
  );
}

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(storeSlug));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(storeSlug), JSON.stringify(items));
    } catch {
      // sessionStorage indisponível — carrinho fica só em memória
    }
  }, [items, storeSlug]);

  function addItem(
    product: PublicProduct,
    quantidade = 1,
    options?: AddItemOptions
  ) {
    setItems((prev) => {
      const existing = prev.find((i) =>
        mesmaVariacao(i, product.id, options)
      );
      if (existing) {
        return prev.map((i) =>
          mesmaVariacao(i, product.id, options)
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        );
      }
      const preco = product.preco_promocional ?? product.preco;
      return [
        ...prev,
        {
          productId: product.id,
          productSlug: product.slug,
          nome: product.nome,
          preco,
          quantidade,
          imagemUrl:
            options?.imagemUrl !== undefined
              ? options.imagemUrl
              : product.imagens[0]?.url ?? null,
          corSelecionada: options?.corSelecionada,
          tamanhoSelecionado: options?.tamanhoSelecionado,
        },
      ];
    });
  }

  function removeItem(chave: string) {
    setItems((prev) => prev.filter((i) => chaveItem(i) !== chave));
  }

  function updateQuantidade(chave: string, quantidade: number) {
    if (quantidade <= 0) {
      removeItem(chave);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (chaveItem(i) === chave ? { ...i, quantidade } : i))
    );
  }

  function clear() {
    setItems([]);
  }

  const total = items.reduce((sum, i) => sum + i.preco * i.quantidade, 0);
  const count = items.reduce((sum, i) => sum + i.quantidade, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantidade, clear, total, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de <CartProvider>");
  return ctx;
}
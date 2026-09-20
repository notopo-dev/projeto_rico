import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { getStoreBySlug, type PublicStore } from "../lib/storeApi";

interface StoreContextValue {
  store: PublicStore | null;
  loading: boolean;
  error: string | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<PublicStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    setLoading(true);
    setError(null);

    getStoreBySlug(slug)
      .then((data) => {
        if (!mounted) return;
        if (!data) {
          setError("Loja não encontrada.");
        } else {
          setStore(data);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Erro ao carregar loja.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  // Aplica as cores da loja como variáveis CSS na raiz, para
  // qualquer componente da loja pública usar via var(--store-primary)
  useEffect(() => {
    if (!store) return;
    document.documentElement.style.setProperty("--store-primary", store.cor_primaria);
    document.documentElement.style.setProperty(
      "--store-secondary",
      store.cor_secundaria
    );
    return () => {
      document.documentElement.style.removeProperty("--store-primary");
      document.documentElement.style.removeProperty("--store-secondary");
    };
  }, [store]);

  return (
    <StoreContext.Provider value={{ store, loading, error }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}
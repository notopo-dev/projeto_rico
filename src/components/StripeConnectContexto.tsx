import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import { ConnectComponentsProvider } from "@stripe/react-connect-js";
import { supabase } from "../lib/supabaseClient";

/**
 * Uma única instância do Connect para a página inteira.
 *
 * ----------------------------------------------------------------
 * Por que isto existe
 * ----------------------------------------------------------------
 * Antes, cada componente criava a sua própria instância e chamava a
 * Edge Function por conta própria. Na tela de Recebimentos isso dava
 * três instâncias e quatro chamadas simultâneas — o banner de
 * notificações, o gerenciamento de conta (que renderiza mesmo dentro
 * de um <details> fechado) e o formulário de verificação.
 *
 * Resultado: a tela ficava carregando sem fim. A própria Stripe
 * alerta contra isso: "Create a single Connect instance by calling
 * loadConnectAndInitialize only once per session. A common mistake is
 * to create one Connect instance per component."
 *
 * Agora a instância nasce aqui, uma vez, e todos os componentes da
 * página a reaproveitam.
 * ----------------------------------------------------------------
 */

interface EstadoConnect {
  connect: StripeConnectInstance | null;
  carregando: boolean;
  erro: string | null;
  /** A loja ainda não tem conta criada — não é erro, é etapa anterior. */
  semConta: boolean;
  tentarDeNovo: () => void;
}

const Contexto = createContext<EstadoConnect | null>(null);

/** Estado do Connect nesta página. Use dentro do provider. */
export function useStripeConnect(): EstadoConnect {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error(
      "useStripeConnect precisa estar dentro de <StripeConnectProvider>."
    );
  }
  return ctx;
}

async function criarSessao(): Promise<{
  client_secret: string;
  publishable_key: string;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-account-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    const err: any = new Error(
      corpo?.error ?? `Erro ao abrir o painel (${res.status}).`
    );
    err.code = corpo?.code;
    throw err;
  }

  return corpo;
}

export function StripeConnectProvider({
  corPrimaria = "#0f1117",
  children,
}: {
  corPrimaria?: string;
  children: ReactNode;
}) {
  const [connect, setConnect] = useState<StripeConnectInstance | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semConta, setSemConta] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const primeiroSecret = useRef<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    if (primeiroSecret.current) {
      const s = primeiroSecret.current;
      primeiroSecret.current = null;
      return s;
    }
    const r = await criarSessao();
    return r.client_secret;
  }, []);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    setSemConta(false);

    (async () => {
      try {
        const { client_secret, publishable_key } = await criarSessao();
        primeiroSecret.current = client_secret;

        const pk =
          publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!pk || !String(pk).startsWith("pk_")) {
          throw new Error("Configuração de pagamento incompleta.");
        }

        const instancia = loadConnectAndInitialize({
          publishableKey: pk,
          fetchClientSecret,
          appearance: {
            overlays: "dialog",
            variables: {
              colorPrimary: corPrimaria,
              colorBackground: "#ffffff",
              colorText: "#0f1117",
              borderRadius: "12px",
              fontFamily:
                "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
              spacingUnit: "9px",
            },
          },
        });

        if (vivo) {
          setConnect(instancia);
          setCarregando(false);
        }
      } catch (e: any) {
        if (!vivo) return;
        if (e?.code === "sem_conta") {
          setSemConta(true);
        } else {
          setErro(e instanceof Error ? e.message : "Erro ao abrir o painel.");
        }
        setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [fetchClientSecret, corPrimaria, tentativa]);

  const valor: EstadoConnect = {
    connect,
    carregando,
    erro,
    semConta,
    tentarDeNovo: () => setTentativa((n) => n + 1),
  };

  return (
    <Contexto.Provider value={valor}>
      {connect ? (
        <ConnectComponentsProvider connectInstance={connect}>
          {children}
        </ConnectComponentsProvider>
      ) : (
        children
      )}
    </Contexto.Provider>
  );
}

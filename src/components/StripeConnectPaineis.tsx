import { useCallback, useEffect, useRef, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectDocuments,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
} from "@stripe/react-connect-js";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/**
 * Painéis embutidos da conta de recebimento.
 *
 * Por que existem: quando a Stripe é responsável pelos saldos negativos
 * (nossa configuração), ela EXIGE que a plataforma tenha os componentes
 * de notificação e de gerenciamento de conta no próprio site. Sem eles,
 * ela recusa criar sessões em produção:
 *   "You cannot create livemode account sessions or account links until
 *    you have supplied URLs at .../connect/site-links"
 *
 * As URLs cadastradas em site-links precisam ser páginas que realmente
 * renderizem estes componentes — a Stripe valida.
 *
 * Onde cada um vai:
 *   Configurações  -> <PainelNotificacoes /> e <PainelGerenciarConta />
 *   Pagamentos     -> <PainelPagamentos />, <PainelRepasses />,
 *                     <PainelSaldos /> e <PainelDocumentos />
 */

async function buscarClientSecret(): Promise<{
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
    throw new Error(corpo?.error ?? `Erro ao abrir o painel (${res.status}).`);
  }
  return corpo;
}

/**
 * Cria UMA instância do Connect e reaproveita para todos os componentes
 * da página. A Stripe recomenda uma instância por sessão, não uma por
 * componente.
 */
function useConnect(corPrimaria: string) {
  const [connect, setConnect] = useState<StripeConnectInstance | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const primeiroSecret = useRef<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    if (primeiroSecret.current) {
      const s = primeiroSecret.current;
      primeiroSecret.current = null;
      return s;
    }
    const r = await buscarClientSecret();
    return r.client_secret;
  }, []);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const { client_secret, publishable_key } = await buscarClientSecret();
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
              borderRadius: "10px",
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
      } catch (e) {
        if (vivo) {
          setErro(e instanceof Error ? e.message : "Erro ao abrir o painel.");
          setCarregando(false);
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, [fetchClientSecret, corPrimaria]);

  return { connect, erro, carregando };
}

interface PainelProps {
  corPrimaria?: string;
  /** Some em silêncio se a conta ainda não existir (não polui a tela). */
  silencioso?: boolean;
}

function Moldura({
  corPrimaria = "#0f1117",
  silencioso = false,
  children,
}: PainelProps & { children: (c: StripeConnectInstance) => React.ReactNode }) {
  const { connect, erro, carregando } = useConnect(corPrimaria);

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[#6b7280]">
        <Loader2 size={15} className="animate-spin" />
        Carregando…
      </div>
    );
  }

  if (erro) {
    if (silencioso) return null;
    return (
      <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
        {erro}
      </p>
    );
  }

  if (!connect) return null;

  return (
    <ConnectComponentsProvider connectInstance={connect}>
      {children(connect)}
    </ConnectComponentsProvider>
  );
}

/** Avisos da conta: pendências de verificação, risco, conformidade. */
export function PainelNotificacoes(props: PainelProps) {
  return (
    <Moldura {...props} silencioso>
      {() => <ConnectNotificationBanner />}
    </Moldura>
  );
}

/** O lojista edita dados do negócio, documentos e conta bancária. */
export function PainelGerenciarConta(props: PainelProps) {
  return <Moldura {...props}>{() => <ConnectAccountManagement />}</Moldura>;
}

/** Histórico de pagamentos, reembolsos e contestações. */
export function PainelPagamentos(props: PainelProps) {
  return <Moldura {...props}>{() => <ConnectPayments />}</Moldura>;
}

/** Histórico de repasses para a conta bancária. */
export function PainelRepasses(props: PainelProps) {
  return <Moldura {...props}>{() => <ConnectPayouts />}</Moldura>;
}

/** Saldo disponível, a caminho e cronograma de repasse. */
export function PainelSaldos(props: PainelProps) {
  return <Moldura {...props}>{() => <ConnectBalances />}</Moldura>;
}

/** Faturas e informes fiscais para download. */
export function PainelDocumentos(props: PainelProps) {
  return <Moldura {...props}>{() => <ConnectDocuments />}</Moldura>;
}

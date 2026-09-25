import { useCallback, useEffect, useRef, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import type { StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/**
 * Onboarding da Stripe RENDERIZADO DENTRO DO NOSSO PAINEL.
 * Não redireciona: o formulário da Stripe aparece na nossa página,
 * com as nossas cores.
 *
 * Por que ele existe, e não só o formulário manual:
 *   - a selfie (proof_of_liveness) e o aceite dos termos
 *     (tos_acceptance) NÃO têm endpoint de API — só a Stripe coleta;
 *   - o Brasil exige verificação reforçada de identidade, da pessoa
 *     jurídica e dos sócios desde o programa de 2025;
 *   - a Stripe mantém o formulário atualizado quando a regra muda.
 *
 * Requer: npm install @stripe/connect-js @stripe/react-connect-js
 */

interface Props {
  /** Cor principal, para o formulário combinar com o painel. */
  corPrimaria?: string;
  /** Chamado quando o lojista termina (ou sai) do fluxo. */
  onConcluido?: () => void;
}

async function chamarFuncao<T>(nome: string, body?: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const res = await fetch(`${supabaseUrl}/functions/v1/${nome}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  let corpo: any = null;
  try {
    corpo = await res.json();
  } catch {
    corpo = null;
  }

  if (!res.ok || corpo?.error) {
    throw new Error(corpo?.error ?? `Erro em ${nome} (status ${res.status}).`);
  }

  return corpo as T;
}

export default function StripeEmbeddedOnboarding({
  corPrimaria = "#0f1117",
  onConcluido,
}: Props) {
  const [connect, setConnect] = useState<StripeConnectInstance | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [finalizado, setFinalizado] = useState(false);
  const [abrindoLink, setAbrindoLink] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const primeiroSecret = useRef<string | null>(null);

  // A Stripe chama isto sempre que precisa de um client_secret novo.
  // O primeiro já veio junto com a chave publicável, então
  // reaproveitamos para não gastar duas sessões à toa.
  const fetchClientSecret = useCallback(async () => {
    if (primeiroSecret.current) {
      const s = primeiroSecret.current;
      primeiroSecret.current = null;
      return s;
    }
    const r = await chamarFuncao<{ client_secret: string }>(
      "stripe-account-session"
    );
    return r.client_secret;
  }, []);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        // A chave publicável vem do backend para não depender de o
        // .env do frontend estar certo.
        const { publishable_key, client_secret } = await chamarFuncao<{
          publishable_key: string;
          client_secret: string;
        }>("stripe-account-session");

        primeiroSecret.current = client_secret;

        const pk =
          publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!pk || !String(pk).startsWith("pk_")) {
          throw new Error(
            "Chave publicável da Stripe ausente ou inválida (precisa começar com pk_)."
          );
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
          setErro(e instanceof Error ? e.message : "Erro ao iniciar o Stripe.");
          setCarregando(false);
        }
      }
    })();

    return () => {
      vivo = false;
    };
  }, [fetchClientSecret, corPrimaria, tentativa]);

  async function abrirNaStripe() {
    setAbrindoLink(true);
    try {
      const { url } = await chamarFuncao<{ url: string }>(
        "stripe-account-link",
        { tipo: "onboarding" }
      );
      window.location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o link.");
      setAbrindoLink(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2.5">
        <Loader2 size={20} className="animate-spin text-[#9ca3af]" />
        <p className="text-[13px] text-[#6b7280]">Carregando o formulário…</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
        <div className="flex gap-2.5">
          <AlertCircle size={17} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#991b1b]">
              Não foi possível abrir o formulário aqui
            </p>
            <p className="text-[12px] text-[#b91c1c] mt-1 break-words">{erro}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setErro(null);
                  setCarregando(true);
                  setTentativa((n) => n + 1);
                }}
                className="h-11 min-h-[44px] px-4 rounded-xl bg-[#0f1117] text-white text-[13px] font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw size={15} />
                Tentar novamente
              </button>

              {/* Saída de emergência: só aparece depois de falhar, para o
                  lojista não ficar sem caminho nenhum. Em operação normal
                  ninguém sai do nosso site. */}
              <button
                onClick={abrirNaStripe}
                disabled={abrindoLink}
                className="h-11 min-h-[44px] px-4 rounded-xl bg-white border border-[#fecaca] text-[13px] font-medium text-[#991b1b] inline-flex items-center gap-2 disabled:opacity-60"
              >
                {abrindoLink ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                Abrir formulário da Stripe
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-5 text-center">
        <CheckCircle2 size={26} className="mx-auto text-[#16a34a]" />
        <p className="mt-2 text-[14px] font-semibold text-[#14532d]">
          Cadastro enviado
        </p>
        <p className="mt-1 text-[12px] text-[#166534] leading-snug">
          A Stripe está analisando seus dados. Isso costuma levar poucos
          minutos. O status aparece atualizado aqui nesta página.
        </p>
      </div>
    );
  }

  return (
    <div>
      {connect && (
        <ConnectComponentsProvider connectInstance={connect}>
          <ConnectAccountOnboarding
            onExit={() => {
              setFinalizado(true);
              onConcluido?.();
            }}
            fullTermsOfServiceUrl="https://moneynotopo.com.br/termos"
            privacyPolicyUrl="https://moneynotopo.com.br/privacidade"
          />
        </ConnectComponentsProvider>
      )}
    </div>
  );
}
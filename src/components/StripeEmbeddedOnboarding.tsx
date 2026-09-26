import { useState } from "react";
import { ConnectAccountOnboarding } from "@stripe/react-connect-js";
import { Loader2, AlertCircle, ExternalLink, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useStripeConnect } from "./StripeConnectContexto";

/**
 * Formulário de verificação, renderizado DENTRO DO NOSSO PAINEL.
 *
 * Usa a instância do Connect criada pelo <StripeConnectProvider> da
 * página — não cria a sua. Antes criava, e com o banner e o
 * gerenciamento de conta na mesma tela davam três instâncias
 * concorrentes, o que deixava a tela carregando sem fim.
 *
 * Por que o formulário é da Stripe e não nosso:
 *   - selfie (proof_of_liveness) e aceite dos termos não têm endpoint
 *     de API — só a Stripe pode coletar;
 *   - o Brasil exige verificação reforçada de identidade, da pessoa
 *     jurídica e dos sócios desde o programa de 2025;
 *   - quando a regra muda, o formulário se atualiza sozinho.
 */

interface Props {
  /** Chamado quando o lojista termina (ou sai) do fluxo. */
  onConcluido?: () => void;
}

export default function StripeEmbeddedOnboarding({ onConcluido }: Props) {
  const { connect, carregando, erro, semConta, tentarDeNovo } =
    useStripeConnect();

  const [finalizado, setFinalizado] = useState(false);
  const [montou, setMontou] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [abrindoLink, setAbrindoLink] = useState(false);

  async function abrirNaStripe() {
    setAbrindoLink(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-account-link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tipo: "onboarding" }),
      });

      const corpo = await res.json().catch(() => ({}));
      if (!res.ok || corpo?.error) {
        throw new Error(corpo?.error ?? "Não foi possível abrir o formulário.");
      }

      window.location.href = corpo.url;
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : "Não foi possível abrir.");
      setAbrindoLink(false);
    }
  }

  if (semConta) return null;

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2.5">
        <Loader2 size={20} className="animate-spin text-[#9ca3af]" />
        <p className="text-[13px] text-[#6b7280]">Abrindo a verificação…</p>
      </div>
    );
  }

  const mensagemErro = erroLocal ?? erro;

  if (mensagemErro) {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
        <div className="flex gap-2.5">
          <AlertCircle size={17} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#991b1b]">
              Não foi possível abrir o formulário aqui
            </p>
            <p className="text-[12px] text-[#b91c1c] mt-1 break-words">
              {mensagemErro}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setErroLocal(null);
                  setMontou(false);
                  tentarDeNovo();
                }}
                className="btn-app-pequeno bg-[#0f1117] text-white"
              >
                <RefreshCw size={14} />
                Tentar novamente
              </button>

              {/* Saída de emergência: só depois de falhar. Em operação
                  normal ninguém sai do nosso site. */}
              <button
                onClick={abrirNaStripe}
                disabled={abrindoLink}
                className="btn-app-pequeno bg-white border border-[#fecaca] text-[#991b1b] disabled:opacity-60"
              >
                {abrindoLink ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ExternalLink size={14} />
                )}
                Abrir em nova janela
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
          Estamos analisando seus dados. Isso costuma levar poucos minutos.
          O status aparece atualizado aqui nesta página.
        </p>
      </div>
    );
  }

  if (!connect) return null;

  return (
    <div>
      <ConnectAccountOnboarding
        onExit={() => {
          setFinalizado(true);
          onConcluido?.();
        }}
        // Sem isto, uma falha antes do primeiro render deixa a área em
        // branco: a Stripe não desenha mensagem se o componente ainda
        // não chegou a aparecer.
        onLoadError={({ error }) => {
          console.error("Stripe onboarding onLoadError:", error);
          setErroLocal(
            `${error?.type ?? "erro"}: ${
              error?.message ?? "causa não detalhada."
            }`
          );
        }}
        onLoaderStart={() => setMontou(true)}
        fullTermsOfServiceUrl="https://moneynotopo.com.br/termos"
        privacyPolicyUrl="https://moneynotopo.com.br/privacidade"
      />

      {!montou && (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-[#6b7280]">
          <Loader2 size={16} className="animate-spin" />
          Abrindo a verificação…
        </div>
      )}
    </div>
  );
}

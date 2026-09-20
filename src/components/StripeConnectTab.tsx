import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import {
  iniciarStripeOnboarding,
  checarStatusStripe,
  type StripeAccountStatus,
} from "../lib/stripeConnectApi";

/**
 * Coloque este componente dentro da aba "Integrações" do
 * Configuracoes.tsx.
 */
export default function StripeConnectTab() {
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarStatus() {
    setLoading(true);
    setErro(null);
    try {
      const data = await checarStatusStripe();
      setStatus(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao verificar status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarStatus();

    // Se o lojista acabou de voltar do onboarding da Stripe,
    // a URL tem ?stripe=return — recarrega o status automaticamente.
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "return") {
      carregarStatus();
    }
  }, []);

  async function handleConectar() {
    setErro(null);
    setConectando(true);
    try {
      const url = await iniciarStripeOnboarding();
      window.location.href = url;
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao iniciar conexão.");
      setConectando(false);
    }
  }

  const pronta = status?.charges_enabled && status?.payouts_enabled;

  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
      <div className="px-4 py-3 border-b border-[#e4e4e7]">
        <h2 className="text-[13px] font-semibold text-[#0f1117]">
          Receber pagamentos com cartão (Stripe)
        </h2>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          Conecte sua conta para receber pagamentos com cartão direto na sua
          conta bancária. Não cobramos comissão sobre as vendas.
        </p>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
            <Loader2 size={15} className="animate-spin" />
            Verificando status...
          </div>
        ) : pronta ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3">
            <CheckCircle2 size={18} className="text-[#16a34a] shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[#15803d]">
                Conta conectada e pronta para receber
              </p>
              <p className="text-[11px] text-[#166534]">
                Pagamentos com cartão já estão disponíveis na sua loja.
              </p>
            </div>
          </div>
        ) : status?.conectado ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3">
              <AlertTriangle size={18} className="text-[#b45309] shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-[#b45309]">
                  Cadastro iniciado, mas incompleto
                </p>
                <p className="text-[11px] text-[#92400e]">
                  Termine de preencher os dados na Stripe para começar a
                  receber pagamentos.
                </p>
              </div>
            </div>
            <button
              onClick={handleConectar}
              disabled={conectando}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium disabled:opacity-60"
            >
              {conectando ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
              Continuar cadastro na Stripe
            </button>
          </div>
        ) : (
          <button
            onClick={handleConectar}
            disabled={conectando}
            className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium disabled:opacity-60"
          >
            {conectando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CreditCard size={14} />
            )}
            Conectar com Stripe
          </button>
        )}

        {erro && (
          <p className="mt-3 text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
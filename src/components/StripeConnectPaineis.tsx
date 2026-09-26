import {
  ConnectAccountManagement,
  ConnectBalances,
  ConnectDocuments,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
} from "@stripe/react-connect-js";
import { Loader2, RefreshCw } from "lucide-react";
import { useStripeConnect } from "./StripeConnectContexto";

/**
 * Painéis embutidos da conta de recebimento.
 *
 * Todos consomem a MESMA instância do Connect, criada uma única vez
 * pelo <StripeConnectProvider> que envolve a página. Antes cada um
 * criava a sua e chamava a Edge Function por conta própria — três
 * instâncias e quatro chamadas na mesma tela, o que travava o
 * carregamento.
 *
 * Onde cada um vive:
 *   Recebimentos -> PainelNotificacoes, PainelGerenciarConta
 *   Pagamentos   -> PainelPagamentos, PainelRepasses, PainelSaldos,
 *                   PainelDocumentos
 *
 * As páginas que os usam estão cadastradas em site-links no Dashboard
 * da Stripe. Trocar a rota de uma delas exige atualizar lá também,
 * senão as sessões param de ser criadas em produção.
 */

interface PainelProps {
  /** Some em silêncio quando a conta ainda não existe ou falhou. */
  silencioso?: boolean;
}

function Moldura({
  silencioso = false,
  children,
}: PainelProps & { children: React.ReactNode }) {
  const { connect, carregando, erro, semConta, tentarDeNovo } =
    useStripeConnect();

  if (carregando) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[#6b7280]">
        <Loader2 size={15} className="animate-spin" />
        Carregando…
      </div>
    );
  }

  // Conta ainda não criada: quem trata isso é a tela de cadastro.
  if (semConta) return null;

  if (erro) {
    if (silencioso) return null;
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
        <p className="text-[12.5px] text-[#b91c1c] break-words">{erro}</p>
        <button
          onClick={tentarDeNovo}
          className="btn-app-pequeno mt-2.5 bg-white border border-[#fecaca] text-[#991b1b]"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!connect) return null;

  return <>{children}</>;
}

/** Avisos da conta: pendências de verificação, risco, conformidade. */
export function PainelNotificacoes() {
  return (
    <Moldura silencioso>
      <ConnectNotificationBanner />
    </Moldura>
  );
}

/** O lojista edita dados do negócio, documentos e conta bancária. */
export function PainelGerenciarConta() {
  return (
    <Moldura>
      <ConnectAccountManagement />
    </Moldura>
  );
}

/** Histórico de pagamentos, reembolsos e contestações. */
export function PainelPagamentos() {
  return (
    <Moldura>
      <ConnectPayments />
    </Moldura>
  );
}

/** Histórico de repasses para a conta bancária. */
export function PainelRepasses() {
  return (
    <Moldura>
      <ConnectPayouts />
    </Moldura>
  );
}

/** Saldo disponível, a caminho e cronograma de repasse. */
export function PainelSaldos() {
  return (
    <Moldura>
      <ConnectBalances />
    </Moldura>
  );
}

/** Faturas e informes fiscais para download. */
export function PainelDocumentos() {
  return (
    <Moldura>
      <ConnectDocuments />
    </Moldura>
  );
}

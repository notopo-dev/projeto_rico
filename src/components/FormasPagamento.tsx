import { useState } from "react";
import {
  CreditCard,
  QrCode,
  Wallet,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Check,
} from "lucide-react";
import {
  ativarCarteirasDigitais,
  salvarFormaPagamento,
  type StatusCompletoStripe,
} from "../lib/stripeCustomApi";
import Interruptor from "./Interruptor";

/**
 * Quais formas de pagamento a loja oferece.
 *
 * Antes isto não existia: o checkout mostrava Pix e cartão sempre,
 * chumbado no código. O cliente escolhia Pix, preenchia tudo, e só no
 * fim a Stripe recusava — porque no Brasil o Pix exige ativação à
 * parte, que a maioria das contas não tem.
 *
 * São duas coisas diferentes, e o checkout exige as duas:
 *   liberado — a Stripe permite este meio NESTA conta
 *   aceita   — o lojista quer oferecer este meio
 *
 * Por isso o interruptor de um meio não liberado aparece travado, com
 * o motivo escrito. Deixar ligar algo que não funciona só empurra o
 * erro para o cliente final.
 */

interface Props {
  status: StatusCompletoStripe;
  /** Recarrega o status depois de salvar. */
  aoSalvar: () => void;
}

function Linha({
  icone,
  titulo,
  descricao,
  liberado,
  aceita,
  salvando,
  motivoTravado,
  onAlternar,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  liberado: boolean;
  aceita: boolean;
  salvando: boolean;
  motivoTravado?: React.ReactNode;
  onAlternar: (novo: boolean) => void;
}) {
  const ligado = liberado && aceita;

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[#6b7280]">{icone}</span>

        <div className="min-w-0 flex-1">
          <p className="t-corpo font-semibold text-[#0f1117]">{titulo}</p>
          <p className="t-apoio text-[#6b7280] leading-snug mt-0.5">
            {descricao}
          </p>
        </div>

        {/* Interruptor */}
        <Interruptor
          ligado={ligado}
          onAlternar={() => onAlternar(!aceita)}
          rotulo={titulo}
          desabilitado={!liberado || salvando}
          carregando={salvando}
        />
      </div>

      {!liberado && motivoTravado && (
        <div className="mt-2 ml-7 flex items-start gap-1.5 rounded-lg bg-[#fffbeb] border border-[#fde68a] px-2.5 py-2">
          <AlertTriangle size={13} className="text-[#b45309] shrink-0 mt-0.5" />
          <div className="t-apoio text-[#92400e] leading-snug">
            {motivoTravado}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormasPagamento({ status, aoSalvar }: Props) {
  const [salvando, setSalvando] = useState<"pix" | "cartao" | null>(null);
  const [ativandoCarteiras, setAtivandoCarteiras] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoCarteiras, setAvisoCarteiras] = useState<string | null>(null);

  // Conta recém-criada ainda não traz "metodos"; assume o conservador.
  const metodos = status.metodos ?? {
    cartao: { liberado: Boolean(status.charges_enabled), aceita: true },
    pix: { liberado: false, aceita: false },
  };

  async function alternar(forma: "pix" | "cartao", novo: boolean) {
    setSalvando(forma);
    setErro(null);
    try {
      await salvarFormaPagamento(forma, novo);
      aoSalvar();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível salvar a mudança.",
      );
    } finally {
      setSalvando(null);
    }
  }

  const carteiras = status.carteiras ?? {
    dominioRegistrado: null,
    ativas: false,
  };

  async function ativarCarteiras() {
    setAtivandoCarteiras(true);
    setErro(null);
    setAvisoCarteiras(null);
    try {
      const r = await ativarCarteirasDigitais();
      setAvisoCarteiras(
        r.applePay === "active" || r.googlePay === "active"
          ? `Liberado para ${r.dominio}. Os botões aparecem no checkout para quem abrir a loja num aparelho compatível.`
          : `Domínio ${r.dominio} enviado. A Stripe valida em alguns minutos — volte aqui depois para conferir.`,
      );
      aoSalvar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível ativar as carteiras.",
      );
    } finally {
      setAtivandoCarteiras(false);
    }
  }

  const nenhumLigado =
    !(metodos.cartao.liberado && metodos.cartao.aceita) &&
    !(metodos.pix.liberado && metodos.pix.aceita);

  return (
    <div className="rounded-lg border border-[#e4e4e7]">
      <div className="px-3.5 py-3 border-b border-[#e4e4e7]">
        <p className="t-corpo font-semibold text-[#0f1117]">
          Formas de pagamento
        </p>
        <p className="t-apoio text-[#6b7280] mt-0.5 leading-snug">
          O que aparece para o cliente no checkout da sua loja.
        </p>
      </div>

      <div className="divide-y divide-[#f0f0f1]">
        <Linha
          icone={<CreditCard size={16} />}
          titulo="Cartão de crédito ou débito"
          descricao="Um ajuste só cobre os dois: para a Stripe, crédito e débito são o mesmo tipo."
          liberado={metodos.cartao.liberado}
          aceita={metodos.cartao.aceita}
          salvando={salvando === "cartao"}
          motivoTravado={
            <>
              Só fica disponível quando a verificação da conta termina.
              Acompanhe o status logo acima nesta página.
            </>
          }
          onAlternar={(novo) => alternar("cartao", novo)}
        />

        <Linha
          icone={<QrCode size={16} />}
          titulo="Pix"
          descricao="O cliente paga pelo QR Code, e o valor cai na hora."
          liberado={metodos.pix.liberado}
          aceita={metodos.pix.aceita}
          salvando={salvando === "pix"}
          motivoTravado={
            <>
              O Pix precisa ser ativado à parte na sua conta de recebimento —
              não vem ligado por padrão. Peça a ativação por{" "}
              <a
                href="https://dashboard.stripe.com/settings/payment_methods"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline inline-flex items-center gap-0.5"
              >
                aqui
                <ExternalLink size={10} />
              </a>
              . Assim que for liberado, este interruptor destrava sozinho.
            </>
          }
          onAlternar={(novo) => alternar("pix", novo)}
        />

        {/* Carteiras digitais.
            Não têm interruptor porque não são forma de pagamento à
            parte: Apple Pay e Google Pay entregam um CARTÃO. O que
            decide é o domínio da loja estar registrado na conta
            conectada — por isso aqui é um botão de ativar, e não um
            liga-desliga. */}
        <div className="px-3.5 py-3">
          <div className="flex items-start gap-3">
            <Wallet size={16} className="mt-0.5 shrink-0 text-[#6b7280]" />
            <div className="min-w-0 flex-1">
              <p className="t-corpo font-semibold text-[#0f1117]">
                Apple Pay e Google Pay
              </p>
              <p className="t-apoio text-[#6b7280] leading-snug mt-0.5">
                Pagamento em um toque, sem digitar o cartão. Aparece sozinho
                para quem abrir a loja num aparelho compatível.
              </p>
            </div>

            {carteiras.ativas && (
              <span className="t-apoio shrink-0 inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 font-semibold text-[#15803d]">
                <Check size={11} />
                Ativo
              </span>
            )}
          </div>

          {!carteiras.ativas && (
            <div className="mt-2.5 ml-7">
              <button
                onClick={ativarCarteiras}
                disabled={ativandoCarteiras || !metodos.cartao.liberado}
                className="btn-app-pequeno bg-[#0f1117] text-white disabled:opacity-50"
              >
                {ativandoCarteiras ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wallet size={14} />
                )}
                {carteiras.dominioRegistrado
                  ? "Conferir liberação"
                  : "Ativar carteiras digitais"}
              </button>
              {!metodos.cartao.liberado && (
                <p className="t-apoio mt-1.5 text-[#9ca3af]">
                  Disponível depois que a conta estiver ativa.
                </p>
              )}
            </div>
          )}

          {avisoCarteiras && (
            <p className="t-apoio mt-2 ml-7 text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-2.5 py-2 leading-snug">
              {avisoCarteiras}
            </p>
          )}
        </div>
      </div>

      {erro && (
        <div className="px-3.5 pb-3">
          <p className="t-apoio text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-2.5 py-2">
            {erro}
          </p>
        </div>
      )}

      {nenhumLigado && !erro && (
        <div className="px-3.5 pb-3">
          <p className="t-apoio text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2.5 py-2 leading-snug">
            Nenhuma forma de pagamento ligada. Sua loja só consegue receber
            pedidos pelo WhatsApp até ligar alguma.
          </p>
        </div>
      )}
    </div>
  );
}

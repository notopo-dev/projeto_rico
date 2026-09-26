import { useState } from "react";
import {
  CreditCard,
  QrCode,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  salvarFormaPagamento,
  type StatusCompletoStripe,
} from "../lib/stripeCustomApi";

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
          <p className="text-[13px] font-semibold text-[#0f1117]">{titulo}</p>
          <p className="text-[11.5px] text-[#6b7280] leading-snug mt-0.5">
            {descricao}
          </p>
        </div>

        {/* Interruptor */}
        <button
          role="switch"
          aria-checked={ligado}
          aria-label={titulo}
          disabled={!liberado || salvando}
          onClick={() => onAlternar(!aceita)}
          className={`sem-toque-minimo relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            ligado ? "bg-[#16a34a]" : "bg-[#d4d4d8]"
          } ${!liberado || salvando ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
              ligado ? "left-[22px]" : "left-0.5"
            }`}
          />
          {salvando && (
            <Loader2
              size={12}
              className="absolute inset-0 m-auto animate-spin text-white"
            />
          )}
        </button>
      </div>

      {!liberado && motivoTravado && (
        <div className="mt-2 ml-7 flex items-start gap-1.5 rounded-lg bg-[#fffbeb] border border-[#fde68a] px-2.5 py-2">
          <AlertTriangle size={13} className="text-[#b45309] shrink-0 mt-0.5" />
          <div className="text-[11.5px] text-[#92400e] leading-snug">
            {motivoTravado}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormasPagamento({ status, aoSalvar }: Props) {
  const [salvando, setSalvando] = useState<"pix" | "cartao" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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

  const nenhumLigado =
    !(metodos.cartao.liberado && metodos.cartao.aceita) &&
    !(metodos.pix.liberado && metodos.pix.aceita);

  return (
    <div className="rounded-xl border border-[#e4e4e7]">
      <div className="px-3.5 py-3 border-b border-[#e4e4e7]">
        <p className="text-[13px] font-semibold text-[#0f1117]">
          Formas de pagamento
        </p>
        <p className="text-[11.5px] text-[#6b7280] mt-0.5 leading-snug">
          O que aparece para o cliente no checkout da sua loja.
        </p>
      </div>

      <div className="divide-y divide-[#f0f0f1]">
        <Linha
          icone={<CreditCard size={16} />}
          titulo="Cartão de crédito"
          descricao="Liberado junto com a sua conta de recebimento."
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
      </div>

      {erro && (
        <div className="px-3.5 pb-3">
          <p className="text-[11.5px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-2.5 py-2">
            {erro}
          </p>
        </div>
      )}

      {nenhumLigado && !erro && (
        <div className="px-3.5 pb-3">
          <p className="text-[11.5px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2.5 py-2 leading-snug">
            Nenhuma forma de pagamento ligada. Sua loja só consegue receber
            pedidos pelo WhatsApp até ligar alguma.
          </p>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Loader2, Ticket, X } from "lucide-react";
import { aplicarCupom, removerCupom, type CupomAplicado } from "../lib/cupomApi";

/**
 * Campo de cupom no checkout.
 *
 * ----------------------------------------------------------------
 * Por que ele fica na etapa de PAGAMENTO
 * ----------------------------------------------------------------
 * O cupom é aplicado no PEDIDO, no banco — e o pedido só existe
 * depois que a cliente confirma os dados. Então o campo aparece
 * junto do formulário de pagamento, antes de a cobrança nascer.
 *
 * Quem chama este componente precisa recriar o formulário de cartão
 * quando o total muda (uma `key` que inclua o total resolve): a
 * cobrança é criada ao montar, com o valor daquele instante. Sem
 * isso, a cliente veria o desconto na tela e pagaria o valor cheio.
 */

interface Props {
  orderId: string;
  /** Avisa o total novo. Também é chamado ao remover o cupom. */
  onTotalMudou: (total: number, cupom: CupomAplicado | null) => void;
}

export default function CampoCupom({ orderId, onTotalMudou }: Props) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [aplicado, setAplicado] = useState<CupomAplicado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim() || ocupado) return;

    setOcupado(true);
    setErro(null);
    try {
      const r = await aplicarCupom(orderId, codigo);
      setAplicado(r);
      onTotalMudou(r.total, r);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Cupom inválido.");
    } finally {
      setOcupado(false);
    }
  }

  async function remover() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await removerCupom(orderId);
      setAplicado(null);
      setCodigo("");
      onTotalMudou(r.total, null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setOcupado(false);
    }
  }

  // ---- cupom já valendo ----
  if (aplicado) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
        <Ticket size={15} className="shrink-0 text-[#15803d]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#15803d]">
            {aplicado.codigo} aplicado
          </p>
          <p className="text-[12px] text-[#166534]">
            {aplicado.desconto > 0 && `−${brl(aplicado.desconto)} no pedido`}
            {aplicado.desconto > 0 && aplicado.frete_gratis && " · "}
            {aplicado.frete_gratis && "frete grátis"}
          </p>
        </div>
        <button
          type="button"
          onClick={remover}
          disabled={ocupado}
          aria-label="Remover cupom"
          className="shrink-0 rounded-lg p-1.5 text-[#15803d] hover:bg-[#dcfce7] disabled:opacity-50"
        >
          {ocupado ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
        </button>
      </div>
    );
  }

  // ---- fechado ----
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-dashed border-[#d4d4d8] px-3 text-[13px] font-medium text-[#6b7280] transition hover:border-[#16a34a] hover:text-[#15803d]"
      >
        <Ticket size={15} />
        Tenho um cupom de desconto
      </button>
    );
  }

  // ---- digitando ----
  return (
    <form onSubmit={aplicar} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Digite o código"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Código do cupom"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[#e4e4e7] bg-white px-3 font-mono text-[14px] uppercase tracking-wide text-[#111827] outline-none focus:border-[#16a34a]"
        />
        <button
          type="submit"
          disabled={ocupado || !codigo.trim()}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          {ocupado && <Loader2 size={14} className="animate-spin" />}
          Aplicar
        </button>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]"
        >
          {erro}
        </p>
      )}
    </form>
  );
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

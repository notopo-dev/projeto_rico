import { Truck, PartyPopper } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";

/**
 * "Frete grátis acima de R$ X" — e quanto falta para chegar lá.
 *
 * A regra já existia no checkout, mas só aparecia no fim, quando a
 * pessoa já tinha decidido o que levar. Frete grátis só aumenta o
 * carrinho se ele for dito ANTES: na vitrine, para atrair, e no
 * carrinho, onde ainda dá tempo de colocar mais um item.
 *
 * Some sozinho quando a loja não tem a regra ligada — nada de faixa
 * vazia ocupando o topo.
 */

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Faixa fina, para o topo da loja. Só anuncia a regra. */
export function FaixaFreteGratis() {
  const { store } = useStore();
  const alvo = store?.frete_gratis_acima ?? null;
  if (!alvo) return null;

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] px-3.5 py-2.5">
        <Truck size={15} className="text-[#15803d] shrink-0" />
        <p className="text-[12.5px] font-semibold text-[#15803d] text-center">
          Frete grátis nas compras acima de {brl(alvo)}
        </p>
      </div>
    </div>
  );
}

/**
 * Barra de progresso, para o carrinho.
 *
 * Mostrar o quanto falta em reais é o que muda comportamento: "faltam
 * R$ 32" é uma decisão que a pessoa consegue tomar ali mesmo; "frete
 * grátis acima de R$ 199" com um carrinho de R$ 167 exige conta de
 * cabeça, e ninguém faz.
 */
export function ProgressoFreteGratis() {
  const { store } = useStore();
  const { total } = useCart();

  const alvo = store?.frete_gratis_acima ?? null;
  if (!alvo || total <= 0) return null;

  const alcancou = total >= alvo;
  const falta = Math.max(alvo - total, 0);
  const proporcao = Math.min(total / alvo, 1);

  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 ${
        alcancou
          ? "bg-[#f0fdf4] border-[#bbf7d0]"
          : "bg-white border-black/5"
      }`}
    >
      <div className="flex items-center gap-2">
        {alcancou ? (
          <PartyPopper size={16} className="text-[#15803d] shrink-0" />
        ) : (
          <Truck size={16} className="text-[#6b7280] shrink-0" />
        )}
        <p
          className={`text-[12.5px] leading-snug ${
            alcancou ? "text-[#15803d] font-semibold" : "text-[#374151]"
          }`}
        >
          {alcancou ? (
            "Você ganhou frete grátis nesta compra."
          ) : (
            <>
              Faltam{" "}
              <strong className="text-[#111827]">{brl(falta)}</strong> para o
              frete grátis
            </>
          )}
        </p>
      </div>

      {!alcancou && (
        <div
          className="mt-2 h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(proporcao * 100)}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${proporcao * 100}%`,
              backgroundColor: "var(--store-primary)",
            }}
          />
        </div>
      )}
    </div>
  );
}

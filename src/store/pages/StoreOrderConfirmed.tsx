import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, QrCode, CreditCard } from "lucide-react";
import { useStore } from "../context/StoreContext";

export default function StoreOrderConfirmed() {
  const { store } = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const numero = params.get("numero");
  const metodo = params.get("metodo");

  if (!store) return null;

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-6 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        <CheckCircle2 size={32} className="text-white" strokeWidth={2} />
      </div>

      <h1 className="text-[19px] font-bold text-[#111827]">
        Pedido #{numero} recebido!
      </h1>
      <p className="mt-1.5 text-[13px] text-[#6b7280] max-w-[280px]">
        {metodo === "pix"
          ? "Assim que configurarmos o pagamento via Pix, você poderá concluir por aqui. Por enquanto, a loja vai entrar em contato para combinar o pagamento."
          : metodo === "cartao"
          ? "Assim que configurarmos o pagamento via cartão, você poderá concluir por aqui. Por enquanto, a loja vai entrar em contato para combinar o pagamento."
          : "A loja já recebeu os detalhes do seu pedido."}
      </p>

      {(metodo === "pix" || metodo === "cartao") && (
        <div className="mt-5 w-full max-w-[280px] rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-4 flex items-center gap-3">
          {metodo === "pix" ? (
            <QrCode size={22} className="text-[#374151] shrink-0" />
          ) : (
            <CreditCard size={22} className="text-[#374151] shrink-0" />
          )}
          <p className="text-[11px] text-[#6b7280] text-left leading-snug">
            Pagamento online chegará em breve. Guarde o número do seu pedido.
          </p>
        </div>
      )}

      <button
        onClick={() => navigate(`/loja/${store.slug}`)}
        className="mt-6 h-12 px-6 rounded-full text-white text-[13px] font-semibold"
        style={{ backgroundColor: "var(--store-primary)" }}
      >
        Voltar para a loja
      </button>
    </div>
  );
}
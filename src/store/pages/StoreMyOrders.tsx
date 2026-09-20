import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  Loader2,
  PackageX,
  Package,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { consultarPedidosPublico, type PedidoConsultado } from "../lib/storeApi";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const statusColor: Record<string, string> = {
  pendente: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  pago: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  enviado: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  entregue: "bg-[#f4f4f5] text-[#52525b] border-[#e4e4e7]",
  cancelado: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
};

export default function StoreMyOrders() {
  const { store } = useStore();
  const navigate = useNavigate();

  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoConsultado[] | null>(null);

  if (!store) return null;

  function formatarCpf(valor: string) {
    const digits = valor.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function buscar() {
    setErro(null);
    setPedidos(null);

    const cpfDigits = cpf.replace(/\D/g, "");
    const telefoneDigits = telefone.replace(/\D/g, "");

    if (cpfDigits.length !== 11) {
      setErro("Informe um CPF válido (11 dígitos).");
      return;
    }
    if (telefoneDigits.length < 10) {
      setErro("Informe um telefone válido.");
      return;
    }

    setBuscando(true);
    try {
      const resultado = await consultarPedidosPublico(
        store!.id,
        cpfDigits,
        telefoneDigits
      );
      setPedidos(resultado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar pedidos.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#fafafa] pb-10">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft size={19} className="text-[#374151]" />
        </button>
        <h1 className="text-[15px] font-bold text-[#111827]">Meus pedidos</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl border border-black/5 p-4">
          <p className="text-[12.5px] text-[#6b7280] mb-3">
            Informe o CPF e o telefone usados na compra para ver seus pedidos.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                CPF
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
              />
            </div>

            {erro && (
              <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
                {erro}
              </p>
            )}

            <button
              onClick={buscar}
              disabled={buscando}
              className="w-full h-12 rounded-xl text-white font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "var(--store-primary)" }}
            >
              {buscando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              {buscando ? "Buscando..." : "Ver meus pedidos"}
            </button>
          </div>
        </div>

        {pedidos !== null && (
          <div className="space-y-3">
            {pedidos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-black/5 py-12 flex flex-col items-center text-center px-6">
                <PackageX size={30} className="text-[#d4d4d8] mb-2" strokeWidth={1.5} />
                <p className="text-[13px] text-[#9ca3af]">
                  Nenhum pedido encontrado com esses dados.
                </p>
              </div>
            ) : (
              pedidos.map((p) => (
                <div
                  key={p.numero}
                  className="bg-white rounded-2xl border border-black/5 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package size={15} className="text-[#9ca3af]" />
                      <span className="text-[13px] font-bold text-[#111827]">
                        Pedido #{p.numero}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                        statusColor[p.status] ?? "bg-[#f4f4f5] text-[#52525b] border-[#e4e4e7]"
                      }`}
                    >
                      {statusLabel[p.status] ?? p.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9ca3af] mb-3">
                    {formatData(p.criado_em)}
                  </p>

                  <div className="space-y-1.5 border-t border-[#f0f0f1] pt-3">
                    {p.itens.map((item, i) => {
                      const variacao = [
                        item.cor_selecionada && `Cor: ${item.cor_selecionada}`,
                        item.tamanho_selecionado && `Tam: ${item.tamanho_selecionado}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <div key={i} className="flex items-start justify-between gap-2 text-[13px]">
                          <div>
                            <p className="text-[#374151]">
                              {item.quantidade}x {item.nome_produto}
                            </p>
                            {variacao && (
                              <p className="text-[11px] text-[#9ca3af]">{variacao}</p>
                            )}
                          </div>
                          <span className="font-medium text-[#111827] shrink-0">
                            {formatBRL(item.subtotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f1]">
                    <span className="text-[12px] text-[#6b7280]">Total</span>
                    <span className="text-[15px] font-extrabold text-[#111827]">
                      {formatBRL(p.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
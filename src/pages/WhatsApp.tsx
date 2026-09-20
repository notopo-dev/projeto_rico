import { useState } from "react";
import { MessageCircle, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X } from "lucide-react";

interface Regra {
  id: string;
  nome: string;
  gatilho: string;
  mensagem: string;
  ativa: boolean;
}

const gatilhos = [
  "Pedido confirmado",
  "Pagamento recebido",
  "Pedido enviado",
  "Pedido entregue",
  "Pedido cancelado",
  "Pagamento pendente (lembrete)",
  "Carrinho abandonado",
];

const initialRegras: Regra[] = [];

let nextId = 1;

export default function WhatsApp() {
  const [regras, setRegras] = useState(initialRegras);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Regra | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formGatilho, setFormGatilho] = useState(gatilhos[0]);
  const [formMensagem, setFormMensagem] = useState("");

  function openAdd() {
    setEditTarget(null);
    setFormNome("");
    setFormGatilho(gatilhos[0]);
    setFormMensagem("");
    setShowModal(true);
  }

  function openEdit(r: Regra) {
    setEditTarget(r);
    setFormNome(r.nome);
    setFormGatilho(r.gatilho);
    setFormMensagem(r.mensagem);
    setShowModal(true);
  }

  function handleSave() {
    if (!formNome.trim() || !formMensagem.trim()) return;
    if (editTarget) {
      setRegras((prev) => prev.map((r) => r.id === editTarget.id ? { ...r, nome: formNome, gatilho: formGatilho, mensagem: formMensagem } : r));
    } else {
      setRegras((prev) => [...prev, { id: String(nextId++), nome: formNome, gatilho: formGatilho, mensagem: formMensagem, ativa: true }]);
    }
    setShowModal(false);
  }

  function toggleAtiva(id: string) {
    setRegras((prev) => prev.map((r) => r.id === id ? { ...r, ativa: !r.ativa } : r));
  }

  function deleteRegra(id: string) {
    setRegras((prev) => prev.filter((r) => r.id !== id));
  }

  const vars = ["{nome}", "{numero}", "{rastreio}", "{prazo}", "{link}", "{valor}"];

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[860px] lg:px-6 lg:py-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[6px] mb-6">
        <MessageCircle size={16} strokeWidth={1.8} className="text-[#16a34a] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-[#15803d] mb-0.5">Automações de WhatsApp</p>
          <p className="text-[12px] text-[#166534]">
            Configure mensagens automáticas para seus clientes em eventos específicos do pedido. Use variáveis como {"{nome}"} e {"{numero}"} para personalizar as mensagens.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[12px] text-[#6b7280]">{regras.length} regra{regras.length !== 1 ? "s" : ""} configurada{regras.length !== 1 ? "s" : ""}</span>
        <button
          onClick={openAdd}
          className="flex min-h-10 shrink-0 items-center gap-1.5 px-3 py-2 bg-[#16a34a] text-white text-[13px] font-medium rounded-xl hover:bg-[#15803d] transition-colors lg:min-h-0 lg:py-1.5 lg:rounded-[6px]"
        >
          <Plus size={15} strokeWidth={2} /> Nova regra
        </button>
      </div>

      {/* Rules */}
      <div className="space-y-3">
        {regras.map((r) => (
          <div key={r.id} className={`bg-white border rounded-2xl lg:rounded-[6px] transition-colors ${r.ativa ? "border-[#e4e4e7]" : "border-[#e4e4e7] opacity-60"}`}>
            <div className="px-4 py-3 flex items-start justify-between gap-2 border-b border-[#f4f4f5]">
              <div className="flex min-w-0 items-start gap-2.5">
                <button onClick={() => toggleAtiva(r.id)} className="flex h-10 w-10 shrink-0 items-center justify-center text-[#6b7280] hover:text-[#0f1117] lg:h-auto lg:w-auto">
                  {r.ativa ? <ToggleRight size={20} className="text-[#16a34a]" strokeWidth={2} /> : <ToggleLeft size={20} strokeWidth={2} />}
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#0f1117]">{r.nome}</p>
                  <span className="text-[11px] font-medium text-[#6b7280] bg-[#f4f4f5] px-1.5 py-0.5 rounded-[3px]">
                    Gatilho: {r.gatilho}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(r)} className="flex h-10 w-10 items-center justify-center text-[#6b7280] hover:text-[#0f1117] rounded hover:bg-[#f4f4f5] lg:h-auto lg:w-auto lg:p-1.5">
                  <Pencil size={14} strokeWidth={1.8} />
                </button>
                <button onClick={() => deleteRegra(r.id)} className="flex h-10 w-10 items-center justify-center text-[#6b7280] hover:text-[#b91c1c] rounded hover:bg-[#fef2f2] lg:h-auto lg:w-auto lg:p-1.5">
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-[12px] text-[#6b7280] bg-[#fafafa] border border-[#f0f0f0] rounded-[4px] px-3 py-2 leading-relaxed">
                {r.mensagem}
              </p>
            </div>
          </div>
        ))}

        {regras.length === 0 && (
          <div className="rounded-2xl border border-[#e4e4e7] bg-white text-center py-12 lg:rounded-[6px]">
            <MessageCircle size={32} strokeWidth={1.5} className="mx-auto text-[#d1d5db] mb-2" />
            <p className="text-[13px] text-[#6b7280]">Nenhuma regra configurada</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-0 lg:items-center lg:p-4">
          <div className="bg-white rounded-t-[18px] border border-[#e4e4e7] w-full max-h-[92dvh] overflow-y-auto lg:max-w-lg lg:rounded-[8px]">
            <div className="px-5 py-4 border-b border-[#e4e4e7] flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#0f1117]">{editTarget ? "Editar regra" : "Nova regra"}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-[#9ca3af] hover:text-[#0f1117]">
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Nome da regra</label>
                <input
                  type="text"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Confirmação de pedido"
                  className="w-full min-h-11 px-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Gatilho</label>
                <select
                  value={formGatilho}
                  onChange={(e) => setFormGatilho(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
                >
                  {gatilhos.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">Mensagem</label>
                <textarea
                  rows={4}
                  value={formMensagem}
                  onChange={(e) => setFormMensagem(e.target.value)}
                  placeholder="Digite a mensagem..."
                  className="w-full px-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] resize-none lg:text-[13px] lg:rounded-[6px]"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {vars.map((v) => (
                    <button
                      key={v}
                      onClick={() => setFormMensagem((m) => m + v)}
                      className="px-1.5 py-0.5 text-[11px] font-mono text-[#15803d] bg-[#f0fdf4] border border-[#bbf7d0] rounded-[3px] hover:bg-[#dcfce7] transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-[#e4e4e7] px-5 py-3 lg:flex lg:justify-end">
              <button onClick={() => setShowModal(false)} className="min-h-11 px-3 py-2 text-[13px] text-[#374151] border border-[#e4e4e7] rounded-xl bg-white hover:bg-[#f4f4f5] transition-colors lg:min-h-0 lg:py-1.5 lg:rounded-[6px]">
                Cancelar
              </button>
              <button onClick={handleSave} className="min-h-11 px-3 py-2 text-[13px] text-white bg-[#16a34a] rounded-xl hover:bg-[#15803d] transition-colors font-medium lg:min-h-0 lg:py-1.5 lg:rounded-[6px]">
                {editTarget ? "Salvar" : "Criar regra"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

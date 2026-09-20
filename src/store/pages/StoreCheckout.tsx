import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MessageCircle, CreditCard, QrCode, Loader2 } from "lucide-react";
import { useStore } from "../context/StoreContext";
import { useCart } from "../context/CartContext";
import { createPublicOrder } from "../lib/storeApi";
import StripeCardPayment from "../components/StripeCardPayment";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function descricaoVariacao(corSelecionada?: string, tamanhoSelecionado?: string) {
  return [
    corSelecionada && `Cor: ${corSelecionada}`,
    tamanhoSelecionado && `Tamanho: ${tamanhoSelecionado}`,
  ]
    .filter(Boolean)
    .join(", ");
}

type Etapa = "dados" | "pagamento";

export default function StoreCheckout() {
  const { store } = useStore();
  const { items, total, clear } = useCart();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState<Etapa>("dados");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumero, setOrderNumero] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [metodo, setMetodo] = useState<"whatsapp" | "pix" | "cartao">(
    store?.modo_compra === "pagamento" ? "pix" : "whatsapp"
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!store) return null;

  const permiteWhatsapp = store.modo_compra === "whatsapp" || store.modo_compra === "ambos";
  const permitePagamento = store.modo_compra === "pagamento" || store.modo_compra === "ambos";

  /**
   * Passo 1: cria o pedido no banco (sempre, para os 3 métodos).
   * Se for WhatsApp, já finaliza e redireciona. Se for Pix/Cartão,
   * avança para a etapa de pagamento embutido (Stripe Elements),
   * SEM sair da tela da loja.
   */
  async function criarPedidoEContinuar() {
    setErro(null);

    if (!nome.trim() || !telefone.trim()) {
      setErro("Preencha seu nome e telefone.");
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setErro("Informe um CPF válido (11 dígitos).");
      return;
    }
    if (items.length === 0) {
      setErro("Seu carrinho está vazio.");
      return;
    }

    setEnviando(true);
    try {
      const order = await createPublicOrder({
        storeId: store.id,
        itens: items.map((i) => ({
          product_id: i.productId,
          nome_produto: i.nome,
          quantidade: i.quantidade,
          preco_unitario: i.preco,
          cor_selecionada: i.corSelecionada,
          tamanho_selecionado: i.tamanhoSelecionado,
        })),
        metodoPagamento: metodo === "whatsapp" ? null : metodo,
        cliente: { nome, telefone, cpf: cpfDigits, email: email || undefined },
      });

      if (metodo === "whatsapp") {
        const baseUrl = window.location.origin;
        const linhas = items
          .map((i) => {
            const variacao = descricaoVariacao(i.corSelecionada, i.tamanhoSelecionado);
            const detalhe = variacao ? ` (${variacao})` : "";
            const linkProduto = `${baseUrl}/loja/${store.slug}/produto/${i.productSlug}`;
            let linha = `• ${i.quantidade}x ${i.nome}${detalhe} — ${formatBRL(i.preco * i.quantidade)}\n  ${linkProduto}`;
            if (i.imagemUrl) {
              linha += `\n  Foto: ${i.imagemUrl}`;
            }
            return linha;
          })
          .join("\n\n");
        const mensagem = encodeURIComponent(
          `Olá! Quero fazer um pedido na ${store.nome} (#${order.numero}):\n\n${linhas}\n\n*Total: ${formatBRL(total)}*\n\nNome: ${nome}`
        );
        const numeroLoja = store.whatsapp ? onlyDigits(store.whatsapp) : "";
        clear();
        window.location.href = `https://wa.me/55${numeroLoja}?text=${mensagem}`;
        return;
      }

      // Pix ou Cartão: pedido criado como "pendente", agora mostra
      // o formulário de pagamento embutido — o carrinho só é
      // limpo depois que o pagamento realmente for confirmado.
      setOrderId(order.id);
      setOrderNumero(order.numero);
      setEtapa("pagamento");
    } catch (err: any) {
      console.error("Erro completo do checkout:", err);
      setErro(err?.message ?? "Erro ao enviar pedido.");
    } finally {
      setEnviando(false);
    }
  }

  function handlePagamentoConfirmado() {
    clear();
    navigate(`/loja/${store.slug}/pedido-confirmado?numero=${orderNumero}&metodo=${metodo}`);
  }

  return (
    <div className="min-h-dvh bg-[#fafafa] pb-32">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-black/5">
        <button
          onClick={() => (etapa === "pagamento" ? setEtapa("dados") : navigate(-1))}
          className="w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          aria-label="Voltar"
        >
          <ChevronLeft size={19} className="text-[#374151]" />
        </button>
        <h1 className="text-[15px] font-bold text-[#111827]">
          {etapa === "dados" ? "Finalizar pedido" : "Pagamento"}
        </h1>
      </div>

      {etapa === "dados" && (
        <div className="px-4 pt-4 space-y-4">
          {/* Dados do cliente */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <h2 className="text-[13px] font-bold text-[#111827] mb-3">Seus dados</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                    const formatted = digits
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d)/, "$1.$2")
                      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                    setCpf(formatted);
                  }}
                  placeholder="000.000.000-00"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Usado para você consultar seus pedidos depois, na loja.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 px-3.5 rounded-xl border border-[#e4e4e7] bg-white text-[15px] outline-none focus:border-[var(--store-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Forma de recebimento do pedido */}
          {(permiteWhatsapp && permitePagamento) && (
            <div className="bg-white rounded-2xl border border-black/5 p-4">
              <h2 className="text-[13px] font-bold text-[#111827] mb-3">
                Como você quer finalizar?
              </h2>
              <div className="space-y-2">
                {permiteWhatsapp && (
                  <button
                    onClick={() => setMetodo("whatsapp")}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                      metodo === "whatsapp"
                        ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                        : "border-[#e4e4e7]"
                    }`}
                  >
                    <MessageCircle size={20} className="text-[#16a34a]" />
                    <div className="text-left">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        Pedir pelo WhatsApp
                      </p>
                      <p className="text-[11px] text-[#9ca3af]">
                        Combine pagamento e entrega direto com a loja
                      </p>
                    </div>
                  </button>
                )}
                {permitePagamento && (
                  <>
                    <button
                      onClick={() => setMetodo("pix")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        metodo === "pix"
                          ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                          : "border-[#e4e4e7]"
                      }`}
                    >
                      <QrCode size={20} className="text-[#374151]" />
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#111827]">
                          Pagar com Pix
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setMetodo("cartao")}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                        metodo === "cartao"
                          ? "border-[var(--store-primary)] bg-[var(--store-primary)]/5"
                          : "border-[#e4e4e7]"
                      }`}
                    >
                      <CreditCard size={20} className="text-[#374151]" />
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-[#111827]">
                          Pagar com cartão
                        </p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <h2 className="text-[13px] font-bold text-[#111827] mb-3">Resumo</h2>
            <div className="space-y-2">
              {items.map((i) => {
                const variacao = descricaoVariacao(i.corSelecionada, i.tamanhoSelecionado);
                return (
                  <div
                    key={`${i.productId}-${i.corSelecionada ?? ""}-${i.tamanhoSelecionado ?? ""}`}
                    className="flex items-start justify-between text-[13px] gap-2"
                  >
                    <div>
                      <p className="text-[#4b5563]">
                        {i.quantidade}x {i.nome}
                      </p>
                      {variacao && (
                        <p className="text-[11px] text-[#9ca3af] mt-0.5">{variacao}</p>
                      )}
                    </div>
                    <span className="font-medium text-[#111827] shrink-0">
                      {formatBRL(i.preco * i.quantidade)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f1]">
              <span className="text-[13px] font-semibold text-[#111827]">Total</span>
              <span className="text-[16px] font-extrabold text-[#111827]">
                {formatBRL(total)}
              </span>
            </div>
          </div>

          {erro && (
            <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
              {erro}
            </p>
          )}
        </div>
      )}

      {etapa === "pagamento" && orderId && (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-black/5 p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f0f0f1]">
              <span className="text-[13px] text-[#6b7280]">Pedido #{orderNumero}</span>
              <span className="text-[16px] font-extrabold text-[#111827]">
                {formatBRL(total)}
              </span>
            </div>
            <StripeCardPayment
              storeId={store.id}
              orderId={orderId}
              totalReais={total}
              metodo={metodo === "pix" ? "pix" : "card"}
              onSuccess={handlePagamentoConfirmado}
              onError={setErro}
            />
          </div>

          {erro && (
            <p className="text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
              {erro}
            </p>
          )}
        </div>
      )}

      {etapa === "dados" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-3 safe-bottom">
          <button
            onClick={criarPedidoEContinuar}
            disabled={enviando}
            className="w-full h-13 min-h-[52px] rounded-2xl text-white font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            {enviando
              ? "Enviando..."
              : metodo === "whatsapp"
              ? "Enviar pedido no WhatsApp"
              : "Continuar para pagamento"}
          </button>
        </div>
      )}
    </div>
  );
}
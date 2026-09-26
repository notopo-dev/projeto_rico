import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  X,
  Phone,
  MapPin,
  Truck,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  atualizarStatusPedido,
  listarPedidos,
  PROXIMOS_STATUS,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS,
  type Pedido,
  type StatusPedido,
} from "../lib/pedidosApi";
import { ListaCarregando } from "../components/Carregando";

/**
 * Pedidos da loja, vindos do banco.
 *
 * Esta tela tinha `const orders: Order[] = []` escrito no código —
 * filtrava e pesquisava dentro de uma lista vazia por construção, então
 * nunca mostrava nada, mesmo com vendas reais no banco.
 */

const TODOS = "todos";

const ABAS: { id: string; rotulo: string }[] = [
  { id: TODOS, rotulo: "Todos" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "pago", rotulo: "Pagos" },
  { id: "enviado", rotulo: "Enviados" },
  { id: "entregue", rotulo: "Entregues" },
  { id: "cancelado", rotulo: "Cancelados" },
];

const CORES_STATUS: Record<StatusPedido, string> = {
  pendente: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  pago: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  enviado: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  entregue: "bg-[#f4f4f5] text-[#3f3f46] border-[#e4e4e7]",
  cancelado: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function Etiqueta({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${CORES_STATUS[status]}`}
    >
      {ROTULO_STATUS[status]}
    </span>
  );
}

/* ------------------------- detalhe do pedido ------------------------- */

function Detalhe({
  pedido,
  onFechar,
  onMudouStatus,
}: {
  pedido: Pedido;
  onFechar: () => void;
  onMudouStatus: () => void;
}) {
  const [salvando, setSalvando] = useState<StatusPedido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const proximos = PROXIMOS_STATUS[pedido.status] ?? [];
  const end = pedido.endereco_entrega;
  const subtotal = pedido.total - pedido.frete;

  async function mudar(novo: StatusPedido) {
    setSalvando(novo);
    setErro(null);
    try {
      await atualizarStatusPedido(pedido.id, novo, pedido.status);
      onMudouStatus();
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      <div className="relative w-full sm:max-w-[520px] max-h-[88dvh] overflow-auto bg-white rounded-t-3xl sm:rounded-3xl anim-surgir safe-bottom">
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-4 py-3.5 border-b border-[#e7e7ea] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[#0f1117]">
              Pedido #{pedido.numero}
            </h2>
            <p className="text-[12px] text-[#9ca3af]">
              {new Date(pedido.created_at).toLocaleString("pt-BR")}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="toque w-9 h-9 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          >
            <X size={17} className="text-[#374151]" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Etiqueta status={pedido.status} />
            {pedido.metodo_pagamento && (
              <span className="text-[12px] text-[#6b7280]">
                {ROTULO_PAGAMENTO[pedido.metodo_pagamento] ??
                  pedido.metodo_pagamento}
              </span>
            )}
          </div>

          {/* Cliente */}
          <div className="cartao-app p-3.5">
            <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
              Cliente
            </p>
            <p className="text-[14px] text-[#0f1117] mt-1">
              {pedido.cliente_nome ?? "Sem cadastro"}
            </p>
            {pedido.cliente_telefone && (
              <a
                href={`https://wa.me/55${pedido.cliente_telefone.replace(
                  /\D/g,
                  ""
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] text-[#16a34a] font-medium"
              >
                <Phone size={13} />
                {pedido.cliente_telefone}
              </a>
            )}
            {pedido.cliente_email && (
              <p className="text-[12.5px] text-[#6b7280] mt-0.5">
                {pedido.cliente_email}
              </p>
            )}
          </div>

          {/* Entrega */}
          {(end || pedido.frete_transportadora) && (
            <div className="cartao-app p-3.5">
              <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
                Entrega
              </p>
              {end && (
                <p className="text-[13px] text-[#374151] mt-1 leading-snug flex gap-1.5">
                  <MapPin size={13} className="text-[#9ca3af] shrink-0 mt-0.5" />
                  <span>
                    {[end.logradouro, end.numero].filter(Boolean).join(", ")}
                    {end.complemento && ` — ${end.complemento}`}
                    {end.bairro && <br />}
                    {end.bairro}
                    {(end.cidade || end.uf) && <br />}
                    {[end.cidade, end.uf].filter(Boolean).join(" / ")}
                    {end.cep && ` · ${end.cep}`}
                  </span>
                </p>
              )}
              {pedido.frete_transportadora && (
                <p className="text-[12.5px] text-[#6b7280] mt-2 flex items-center gap-1.5">
                  <Truck size={13} className="text-[#9ca3af]" />
                  {pedido.frete_transportadora}
                  {pedido.frete_prazo_dias != null &&
                    ` · até ${pedido.frete_prazo_dias} dias`}
                </p>
              )}
              {pedido.codigo_rastreio && (
                <p className="text-[12.5px] text-[#374151] mt-1 font-medium">
                  Rastreio: {pedido.codigo_rastreio}
                </p>
              )}
            </div>
          )}

          {/* Itens */}
          <div className="cartao-app p-3.5">
            <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold mb-2">
              Itens
            </p>
            <div className="space-y-2.5">
              {pedido.itens.map((i) => (
                <div key={i.id} className="flex gap-3 items-start">
                  <span className="text-[12px] font-bold text-[#6b7280] shrink-0 mt-0.5">
                    {i.quantidade}×
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#0f1117] leading-snug">
                      {i.nome_produto}
                    </p>
                    {(i.cor_selecionada || i.tamanho_selecionado) && (
                      <p className="text-[11.5px] text-[#9ca3af]">
                        {[
                          i.cor_selecionada && `Cor: ${i.cor_selecionada}`,
                          i.tamanho_selecionado &&
                            `Tam: ${i.tamanho_selecionado}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-[#0f1117] shrink-0 tabular-nums">
                    {brl(i.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-[#f0f0f1] space-y-1">
              <div className="flex justify-between text-[12.5px] text-[#6b7280]">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(subtotal)}</span>
              </div>
              {pedido.frete > 0 && (
                <div className="flex justify-between text-[12.5px] text-[#6b7280]">
                  <span>Frete</span>
                  <span className="tabular-nums">{brl(pedido.frete)}</span>
                </div>
              )}
              <div className="flex justify-between text-[15px] font-bold text-[#0f1117] pt-1">
                <span>Total</span>
                <span className="tabular-nums">{brl(pedido.total)}</span>
              </div>
            </div>
          </div>

          {erro && (
            <p className="text-[12.5px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
              {erro}
            </p>
          )}

          {/* Próximo passo */}
          {proximos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
                Marcar como
              </p>
              {proximos.map((s) => (
                <button
                  key={s}
                  onClick={() => mudar(s)}
                  disabled={salvando !== null}
                  className={
                    s === "cancelado"
                      ? "btn-app-claro text-[#b91c1c] border-[#fecaca]"
                      : "btn-app"
                  }
                >
                  {salvando === s ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  {ROTULO_STATUS[s]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-[#9ca3af] text-center py-2">
              Este pedido está {ROTULO_STATUS[pedido.status].toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ lista ------------------------------ */

export default function Orders() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState(TODOS);
  const [aberto, setAberto] = useState<Pedido | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await listarPedidos());
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar os pedidos."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      const porAba = aba === TODOS || p.status === aba;
      if (!porAba) return false;
      if (!termo) return true;

      return (
        String(p.numero).includes(termo) ||
        (p.cliente_nome ?? "").toLowerCase().includes(termo) ||
        (p.cliente_telefone ?? "").includes(termo) ||
        p.itens.some((i) => i.nome_produto.toLowerCase().includes(termo))
      );
    });
  }, [pedidos, busca, aba]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { [TODOS]: pedidos.length };
    pedidos.forEach((p) => {
      c[p.status] = (c[p.status] ?? 0) + 1;
    });
    return c;
  }, [pedidos]);

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-3.5">
      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número, cliente ou produto"
            className="w-full h-12 pl-10 pr-3 rounded-xl bg-white border border-[#e7e7ea] text-[14px] outline-none focus:border-[#0f1117] transition-colors"
          />
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="toque w-12 rounded-xl bg-white border border-[#e7e7ea] flex items-center justify-center disabled:opacity-50"
          aria-label="Atualizar"
        >
          <RefreshCw
            size={16}
            className={`text-[#6b7280] ${carregando ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {ABAS.map(({ id, rotulo }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`btn-app-pequeno shrink-0 border ${
              aba === id
                ? "bg-[#0f1117] text-white border-[#0f1117]"
                : "bg-white text-[#374151] border-[#e7e7ea]"
            }`}
          >
            {rotulo}
            {contagem[id] > 0 && (
              <span
                className={`ml-1 text-[11px] ${
                  aba === id ? "text-white/70" : "text-[#9ca3af]"
                }`}
              >
                {contagem[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {erro && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-[#b91c1c] break-words">{erro}</p>
            <button
              onClick={carregar}
              className="text-[12px] font-semibold text-[#991b1b] underline mt-1"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <ListaCarregando linhas={5} />
      ) : filtrados.length === 0 ? (
        <div className="py-16 text-center">
          <ShoppingBag
            size={34}
            className="mx-auto text-[#d4d4d8] mb-2.5"
            strokeWidth={1.5}
          />
          <p className="text-[14px] font-semibold text-[#0f1117]">
            {pedidos.length === 0 ? "Nenhum pedido ainda" : "Nada encontrado"}
          </p>
          <p className="text-[12.5px] text-[#9ca3af] mt-1">
            {pedidos.length === 0
              ? "Os pedidos da sua loja aparecem aqui assim que o primeiro chegar."
              : "Tente outro termo ou troque de aba."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 anim-lista">
          {filtrados.map((p) => {
            const totalItens = p.itens.reduce((s, i) => s + i.quantidade, 0);
            return (
              <button
                key={p.id}
                onClick={() => setAberto(p)}
                className="cartao-app cartao-toque w-full p-3.5 text-left flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-[#0f1117]">
                      #{p.numero}
                    </span>
                    <Etiqueta status={p.status} />
                  </div>

                  <p className="text-[13px] text-[#374151] mt-1 truncate">
                    {p.cliente_nome ?? "Cliente sem cadastro"}
                  </p>

                  <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                    {dataCurta(p.created_at)} · {totalItens}{" "}
                    {totalItens === 1 ? "item" : "itens"}
                    {p.metodo_pagamento &&
                      ` · ${
                        ROTULO_PAGAMENTO[p.metodo_pagamento] ??
                        p.metodo_pagamento
                      }`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-[#0f1117] tabular-nums">
                    {brl(p.total)}
                  </p>
                  <ChevronRight
                    size={16}
                    className="text-[#d4d4d8] ml-auto mt-1"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {aberto && (
        <Detalhe
          pedido={aberto}
          onFechar={() => setAberto(null)}
          onMudouStatus={carregar}
        />
      )}
    </div>
  );
}

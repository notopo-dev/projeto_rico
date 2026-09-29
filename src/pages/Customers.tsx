import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  RefreshCw,
  AlertCircle,
  MessageCircle,
  Mail,
  X,
  ChevronDown,
  Check,
  Loader2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  atualizarCliente,
  listarClientes,
  type Cliente,
} from "../lib/clientesApi";
import {
  descreverPagamento,
  listarPedidosDoCliente,
  ROTULO_CURTO,
  type Pedido,
  type StatusPedido,
} from "../lib/pedidosApi";
import { ListaCarregando } from "../components/Carregando";

/**
 * Clientes da loja, vindos do banco.
 *
 * Esta tela tinha `const customers = []` escrito no código: pesquisava
 * dentro de uma lista vazia por construção e nunca mostrava ninguém,
 * mesmo com clientes reais cadastrados. Era o mesmo defeito de Pedidos.
 */

type Ordem = "recentes" | "gasto" | "pedidos" | "nome";

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "recentes", rotulo: "Mais recentes" },
  { id: "gasto", rotulo: "Quem mais gastou" },
  { id: "pedidos", rotulo: "Quem mais comprou" },
  { id: "nome", rotulo: "Nome" },
];

const CORES_STATUS: Record<StatusPedido, string> = {
  pendente: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  pago: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  enviado: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  entregue: "bg-[#f4f4f5] text-[#3f3f46] border-[#e4e4e7]",
  cancelado: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  devolvido: "bg-[#faf5ff] text-[#7e22ce] border-[#e9d5ff]",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function apenasDigitos(v: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

function inicial(nome: string) {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

/* ------------------------- ficha do cliente ------------------------- */

/**
 * Tudo sobre um cliente numa folha só: contato e histórico de compras.
 *
 * Cada pedido da lista abre para mostrar os itens. A lista fechada
 * serve para varrer o histórico; os itens, para conferir um pedido —
 * mostrar tudo aberto de uma vez vira parede de texto em quem compra
 * com frequência.
 */
function Ficha({
  cliente,
  onFechar,
  aoSalvar,
}: {
  cliente: Cliente;
  onFechar: () => void;
  aoSalvar: () => void;
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  /* Edição do cadastro. */
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nome: cliente.nome,
    email: cliente.email ?? "",
    telefone: cliente.telefone ?? "",
    cpf: cliente.cpf ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function abrirEdicao() {
    setForm({
      nome: cliente.nome,
      email: cliente.email ?? "",
      telefone: cliente.telefone ?? "",
      cpf: cliente.cpf ?? "",
    });
    setErroForm(null);
    setEditando(true);
  }

  async function salvarCadastro() {
    setSalvando(true);
    setErroForm(null);
    try {
      await atualizarCliente(cliente.id, form);
      setEditando(false);
      aoSalvar();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar o cadastro.",
      );
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await listarPedidosDoCliente(cliente.id);
        if (vivo) setPedidos(lista);
      } catch (e) {
        if (vivo) {
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar o histórico.",
          );
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cliente.id]);

  /* Trava a rolagem do fundo e fecha no Esc. */
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  const zap = apenasDigitos(cliente.telefone);

  return (
    <div className="folha-fundo">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] sem-toque-minimo"
      />

      <div className="folha anim-surgir" role="dialog" aria-modal="true">
        <div className="folha-topo px-4 py-3 border-b border-[#e7e7ea] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="t-corpo w-10 h-10 shrink-0 rounded-full bg-[#f4f4f5] flex items-center justify-center font-bold text-[#374151]">
              {inicial(cliente.nome)}
            </div>
            <div className="min-w-0">
              <h2 className="t-secao font-bold text-[#0f1117] truncate">
                {cliente.nome}
              </h2>
              <p className="t-corpo text-[#9ca3af]">
                Cliente desde {dataCurta(cliente.criado_em)}
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="toque w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
          >
            <X size={18} className="text-[#374151]" />
          </button>
        </div>

        <div className="folha-corpo px-4 py-4 space-y-3">
          {/* Números */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { r: "Pedidos", v: String(cliente.pedidos) },
              { r: "Total gasto", v: brl(cliente.gasto) },
              { r: "Última", v: dataCurta(cliente.ultima_compra) },
            ].map((t) => (
              <div key={t.r} className="cartao-app p-3 text-center">
                <p className="t-micro text-[#9ca3af] uppercase tracking-wide font-semibold">
                  {t.r}
                </p>
                <p className="t-corpo font-bold text-[#0f1117] mt-0.5 tabular-nums">
                  {t.v}
                </p>
              </div>
            ))}
          </div>

          {/* Cadastro */}
          <div className="cartao-app p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="t-apoio text-[#9ca3af] uppercase tracking-wide font-semibold">
                Cadastro
              </p>
              {!editando && (
                <button
                  onClick={abrirEdicao}
                  className="t-corpo sem-toque-minimo inline-flex items-center gap-1.5 font-semibold text-[#374151]"
                >
                  <Pencil size={13} />
                  Editar
                </button>
              )}
            </div>

            {editando ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="t-apoio block font-medium text-[#6b7280] mb-1">
                    Nome completo
                  </label>
                  <input
                    value={form.nome}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nome: e.target.value }))
                    }
                    autoFocus
                    placeholder="Nome do cliente"
                    className="campo-app"
                  />
                </div>

                <div>
                  <label className="t-apoio block font-medium text-[#6b7280] mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    value={form.telefone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, telefone: e.target.value }))
                    }
                    inputMode="tel"
                    placeholder="(00) 00000-0000"
                    className="campo-app"
                  />
                </div>

                <div>
                  <label className="t-apoio block font-medium text-[#6b7280] mb-1">
                    CPF
                  </label>
                  <input
                    value={form.cpf}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cpf: e.target.value }))
                    }
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    className="campo-app"
                  />
                  <p className="t-apoio mt-1 text-[#9ca3af] leading-snug">
                    CPF e telefone são o que o cliente digita na loja para
                    acompanhar os pedidos dele.
                  </p>
                </div>

                <div>
                  <label className="t-apoio block font-medium text-[#6b7280] mb-1">
                    E-mail
                  </label>
                  <input
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    inputMode="email"
                    placeholder="cliente@email.com"
                    className="campo-app"
                  />
                </div>

                {erroForm && (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5">
                    <p className="t-corpo text-[#b91c1c] leading-snug">
                      {erroForm}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={salvarCadastro}
                    disabled={salvando}
                    className="btn-app"
                  >
                    {salvando ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Salvar
                  </button>
                  <button
                    onClick={() => {
                      setEditando(false);
                      setErroForm(null);
                    }}
                    disabled={salvando}
                    className="btn-app-claro"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-1.5 space-y-0.5">
                  <p className="t-corpo text-[#374151]">
                    {cliente.telefone || (
                      <span className="text-[#9ca3af]">Sem telefone</span>
                    )}
                  </p>
                  <p className="t-corpo text-[#374151] break-all">
                    {cliente.email || (
                      <span className="text-[#9ca3af]">Sem e-mail</span>
                    )}
                  </p>
                  <p className="t-corpo text-[#6b7280]">
                    {cliente.cpf ? (
                      `CPF ${cliente.cpf}`
                    ) : (
                      <span className="text-[#9ca3af]">Sem CPF</span>
                    )}
                  </p>
                </div>

                {/* Sem CPF ou sem telefone o cliente não consegue
                    consultar os próprios pedidos na loja: a consulta
                    exige os dois. Cadastros antigos, de antes de a loja
                    pedir CPF, ficaram assim. Quem completa é você, aqui
                    — no checkout isso deixaria alguém que soubesse um
                    telefone carimbar o próprio CPF num cadastro alheio
                    e passar a enxergar o histórico da vítima. */}
                {(!cliente.cpf || !cliente.telefone) && (
                  <div className="mt-2.5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 flex items-start gap-2.5">
                    <AlertTriangle
                      size={14}
                      className="text-[#b45309] shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="t-apoio text-[#92400e] leading-snug">
                        Falta{" "}
                        {!cliente.cpf && !cliente.telefone
                          ? "o CPF e o telefone"
                          : !cliente.cpf
                            ? "o CPF"
                            : "o telefone"}
                        . Sem os dois, este cliente não consegue acompanhar
                        os pedidos dele na loja.
                      </p>
                      <button
                        onClick={abrirEdicao}
                        className="t-corpo mt-1.5 sem-toque-minimo inline-flex items-center gap-1.5 font-semibold text-[#92400e] underline"
                      >
                        <Pencil size={13} />
                        Completar cadastro
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 flex gap-2">
                  {zap && (
                    <a
                      href={`https://wa.me/55${zap}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-app-claro text-[#15803d] border-[#bbf7d0]"
                    >
                      <MessageCircle size={15} />
                      WhatsApp
                    </a>
                  )}
                  {cliente.email && (
                    <a
                      href={`mailto:${cliente.email}`}
                      className="btn-app-claro"
                    >
                      <Mail size={15} />
                      E-mail
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Histórico */}
          <div>
            <p className="t-apoio text-[#9ca3af] uppercase tracking-wide font-semibold mb-2 px-1">
              Histórico de pedidos
            </p>

            {erro && (
              <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5">
                <p className="t-corpo text-[#b91c1c]">{erro}</p>
              </div>
            )}

            {carregando ? (
              <ListaCarregando linhas={3} />
            ) : pedidos.length === 0 ? (
              <p className="t-corpo text-[#9ca3af] text-center py-8">
                Este cliente ainda não fez nenhum pedido.
              </p>
            ) : (
              <div className="space-y-2">
                {pedidos.map((p) => {
                  const abertoAqui = aberto === p.id;
                  const totalItens = p.itens.reduce(
                    (s, i) => s + i.quantidade,
                    0,
                  );

                  return (
                    <div key={p.id} className="cartao-app overflow-hidden">
                      <button
                        onClick={() => setAberto(abertoAqui ? null : p.id)}
                        aria-expanded={abertoAqui}
                        className="w-full p-3.5 text-left flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="t-corpo font-bold text-[#0f1117]">
                              #{p.numero}
                            </span>
                            <span
                              className={`t-apoio inline-flex items-center px-2 py-0.5 rounded-full font-semibold border ${CORES_STATUS[p.status]}`}
                            >
                              {ROTULO_CURTO[p.status]}
                            </span>
                          </div>
                          <p className="t-apoio text-[#9ca3af] mt-1">
                            {dataHora(p.created_at)} · {totalItens}{" "}
                            {totalItens === 1 ? "item" : "itens"}
                            {` · ${descreverPagamento(p)}`}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="t-corpo font-bold text-[#0f1117] tabular-nums">
                            {brl(p.total)}
                          </p>
                          <ChevronDown
                            size={15}
                            className={`text-[#d4d4d8] ml-auto mt-1 transition-transform ${
                              abertoAqui ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      {abertoAqui && (
                        <div className="border-t border-[#f0f0f1] px-3.5 py-3 space-y-2">
                          {p.itens.map((i) => (
                            <div key={i.id} className="flex gap-3 items-start">
                              <span className="t-corpo font-bold text-[#6b7280] shrink-0 mt-0.5">
                                {i.quantidade}×
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="t-corpo text-[#0f1117] leading-snug">
                                  {i.nome_produto}
                                </p>
                                {(i.cor_selecionada ||
                                  i.tamanho_selecionado) && (
                                  <p className="t-apoio text-[#9ca3af]">
                                    {[i.cor_selecionada, i.tamanho_selecionado]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                              </div>
                              <span className="t-corpo font-medium text-[#0f1117] shrink-0 tabular-nums">
                                {brl(i.subtotal)}
                              </span>
                            </div>
                          ))}

                          {p.frete > 0 && (
                            <div className="t-corpo flex justify-between text-[#6b7280] pt-1.5 border-t border-[#f0f0f1]">
                              <span>Frete</span>
                              <span className="tabular-nums">
                                {brl(p.frete)}
                              </span>
                            </div>
                          )}

                          {p.valor_reembolsado > 0 && (
                            <div className="t-corpo flex justify-between text-[#7e22ce]">
                              <span>Devolvido</span>
                              <span className="tabular-nums">
                                − {brl(p.valor_reembolsado)}
                              </span>
                            </div>
                          )}

                          {p.codigo_rastreio && (
                            <p className="t-corpo text-[#374151] pt-1">
                              Rastreio: {p.codigo_rastreio}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ lista ------------------------------ */

export default function Customers() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setClientes(await listarClientes());
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os clientes.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const filtrados = clientes.filter((c) => {
      if (!termo) return true;
      return (
        c.nome.toLowerCase().includes(termo) ||
        (c.email ?? "").toLowerCase().includes(termo) ||
        apenasDigitos(c.telefone).includes(apenasDigitos(termo))
      );
    });

    const ordenados = [...filtrados];
    if (ordem === "gasto") ordenados.sort((a, b) => b.gasto - a.gasto);
    else if (ordem === "pedidos")
      ordenados.sort((a, b) => b.pedidos - a.pedidos);
    else if (ordem === "nome")
      ordenados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    else
      ordenados.sort((a, b) => {
        const x = a.ultima_compra ?? a.criado_em;
        const y = b.ultima_compra ?? b.criado_em;
        return y.localeCompare(x);
      });

    return ordenados;
  }, [clientes, busca, ordem]);

  /* Lê do array vivo: depois de recarregar, a ficha aberta mostra os
     números novos sem precisar fechar e abrir. */
  const aberta = useMemo(
    () => clientes.find((c) => c.id === abertoId) ?? null,
    [clientes, abertoId],
  );

  const totais = useMemo(() => {
    const compraram = clientes.filter((c) => c.pedidos > 0);
    const receita = clientes.reduce((s, c) => s + c.gasto, 0);
    return {
      cadastrados: clientes.length,
      compraram: compraram.length,
      receita,
      ticket: compraram.length ? receita / compraram.length : 0,
    };
  }, [clientes]);

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-3.5">
      {/* Resumo */}
      {!carregando && clientes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { rotulo: "Cadastrados", valor: String(totais.cadastrados) },
            { rotulo: "Já compraram", valor: String(totais.compraram) },
            { rotulo: "Receita", valor: brl(totais.receita) },
            { rotulo: "Média por cliente", valor: brl(totais.ticket) },
          ].map((t) => (
            <div key={t.rotulo} className="cartao-app p-3.5">
              <p className="t-apoio text-[#9ca3af] uppercase tracking-wide font-semibold">
                {t.rotulo}
              </p>
              <p className="t-secao font-bold text-[#0f1117] mt-1 tabular-nums">
                {t.valor}
              </p>
            </div>
          ))}
        </div>
      )}

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
            placeholder="Nome, e-mail ou telefone"
            className="t-corpo w-full h-12 pl-10 pr-3 rounded-lg bg-white border border-[#e7e7ea] outline-none focus:border-[#0f1117] transition-colors"
          />
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="toque w-12 rounded-lg bg-white border border-[#e7e7ea] flex items-center justify-center disabled:opacity-50"
          aria-label="Atualizar"
        >
          <RefreshCw
            size={16}
            className={`text-[#6b7280] ${carregando ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Ordenação */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {ORDENS.map(({ id, rotulo }) => (
          <button
            key={id}
            onClick={() => setOrdem(id)}
            className={`btn-app-pequeno shrink-0 border ${
              ordem === id
                ? "bg-[#0f1117] text-white border-[#0f1117]"
                : "bg-white text-[#374151] border-[#e7e7ea]"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="t-corpo text-[#b91c1c] break-words">{erro}</p>
            <button
              onClick={carregar}
              className="t-corpo sem-toque-minimo font-semibold text-[#991b1b] underline mt-1"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <ListaCarregando linhas={5} />
      ) : lista.length === 0 ? (
        <div className="py-16 text-center">
          <Users
            size={34}
            className="mx-auto text-[#d4d4d8] mb-2.5"
            strokeWidth={1.5}
          />
          <p className="t-corpo font-semibold text-[#0f1117]">
            {clientes.length === 0 ? "Nenhum cliente ainda" : "Nada encontrado"}
          </p>
          <p className="t-corpo text-[#9ca3af] mt-1">
            {clientes.length === 0
              ? "Quem comprar na sua loja aparece aqui automaticamente."
              : "Tente outro nome, e-mail ou telefone."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 anim-lista">
          {lista.map((c) => {
            const zap = apenasDigitos(c.telefone);
            return (
              <div key={c.id} className="cartao-app overflow-hidden">
                <button
                  onClick={() => setAbertoId(c.id)}
                  className="w-full p-3.5 text-left flex items-start gap-3"
                >
                  <div className="t-corpo w-10 h-10 shrink-0 rounded-full bg-[#f4f4f5] flex items-center justify-center font-bold text-[#374151]">
                    {inicial(c.nome)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="t-corpo font-semibold text-[#0f1117] truncate">
                      {c.nome}
                    </p>
                    {c.email && (
                      <p className="t-corpo text-[#6b7280] truncate">
                        {c.email}
                      </p>
                    )}
                    {c.telefone && (
                      <p className="t-corpo text-[#6b7280]">{c.telefone}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="t-secao font-bold text-[#0f1117] tabular-nums">
                      {brl(c.gasto)}
                    </p>
                    <p className="t-apoio text-[#9ca3af]">
                      {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </button>

                <div className="px-3.5 pb-3 pt-3 border-t border-[#f0f0f1] flex items-center justify-between gap-3">
                  <p className="t-apoio text-[#9ca3af]">
                    {c.pedidos > 0
                      ? `Última compra em ${dataCurta(c.ultima_compra)}`
                      : `Cadastrado em ${dataCurta(c.criado_em)} · ainda não comprou`}
                  </p>

                  <div className="flex items-center gap-3 shrink-0">
                    {zap && (
                      <a
                        href={`https://wa.me/55${zap}`}
                        target="_blank"
                        rel="noreferrer"
                        className="t-corpo sem-toque-minimo inline-flex items-center gap-1 font-semibold text-[#15803d]"
                      >
                        <MessageCircle size={13} />
                        WhatsApp
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="t-corpo sem-toque-minimo inline-flex items-center gap-1 font-semibold text-[#374151]"
                      >
                        <Mail size={13} />
                        E-mail
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aberta && (
        <Ficha
          key={aberta.id}
          cliente={aberta}
          onFechar={() => setAbertoId(null)}
          aoSalvar={carregar}
        />
      )}
    </div>
  );
}

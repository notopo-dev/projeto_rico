import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Search,
  Package,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  ajustarEstoque,
  listarEstoque,
  type ItemEstoque,
  type SituacaoEstoque,
} from "../lib/estoqueApi";
import { ListaCarregando } from "../components/Carregando";

/**
 * Estoque da loja, vindo do banco.
 *
 * Esta tela tinha `const initialItems: StockItem[] = []` com um
 * comentário dizendo que os produtos viriam do Supabase
 * "posteriormente". Nunca vieram — a tela filtrava e editava uma
 * lista vazia por construção.
 */

type Filtro = "todos" | SituacaoEstoque;

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "baixo", rotulo: "Acabando" },
  { id: "sem", rotulo: "Sem estoque" },
  { id: "ok", rotulo: "Em estoque" },
];

const VISUAL: Record<
  SituacaoEstoque,
  { cor: string; icone: ReactNode; rotulo: string }
> = {
  ok: {
    cor: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
    icone: <CheckCircle2 size={13} />,
    rotulo: "Em estoque",
  },
  baixo: {
    cor: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
    icone: <AlertTriangle size={13} />,
    rotulo: "Acabando",
  },
  sem: {
    cor: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
    icone: <XCircle size={13} />,
    rotulo: "Sem estoque",
  },
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Estoque() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await listarEstoque());
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar o estoque.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(item: ItemEstoque) {
    setSalvando(item.id);
    setErro(null);
    try {
      await ajustarEstoque(item.id, Number(valor));
      await carregar();
      setEditando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(null);
    }
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (filtro !== "todos" && i.situacao !== filtro) return false;
      if (!termo) return true;
      return (
        i.nome.toLowerCase().includes(termo) ||
        (i.sku ?? "").toLowerCase().includes(termo) ||
        (i.categoria ?? "").toLowerCase().includes(termo)
      );
    });
  }, [itens, busca, filtro]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: itens.length };
    itens.forEach((i) => {
      c[i.situacao] = (c[i.situacao] ?? 0) + 1;
    });
    return c;
  }, [itens]);

  const precisaAtencao = (contagem.baixo ?? 0) + (contagem.sem ?? 0);

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-3.5">
      {/* Aviso de reposição */}
      {!carregando && precisaAtencao > 0 && filtro === "todos" && (
        <button
          onClick={() => setFiltro(contagem.sem ? "sem" : "baixo")}
          className="w-full cartao-app cartao-toque p-3.5 text-left flex items-start gap-2.5 border-[#fde68a] bg-[#fffbeb]"
        >
          <AlertTriangle size={16} className="text-[#b45309] shrink-0 mt-0.5" />
          <div>
            <p className="t-corpo font-semibold text-[#b45309]">
              {precisaAtencao}{" "}
              {precisaAtencao === 1 ? "produto precisa" : "produtos precisam"}{" "}
              de reposição
            </p>
            <p className="t-apoio text-[#92400e] leading-snug">
              {contagem.sem
                ? `${contagem.sem} sem estoque nenhum. Produto sem estoque não vende.`
                : "Estão abaixo do mínimo que você definiu."}
            </p>
          </div>
        </button>
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
            placeholder="Produto, SKU ou categoria"
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

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {FILTROS.map(({ id, rotulo }) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`btn-app-pequeno shrink-0 border ${
              filtro === id
                ? "bg-[#0f1117] text-white border-[#0f1117]"
                : "bg-white text-[#374151] border-[#e7e7ea]"
            }`}
          >
            {rotulo}
            {contagem[id] > 0 && (
              <span
                className={`t-apoio ml-1 ${
                  filtro === id ? "text-white/70" : "text-[#9ca3af]"
                }`}
              >
                {contagem[id]}
              </span>
            )}
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
        <ListaCarregando linhas={6} />
      ) : filtrados.length === 0 ? (
        <div className="py-16 text-center">
          <Package
            size={34}
            className="mx-auto text-[#d4d4d8] mb-2.5"
            strokeWidth={1.5}
          />
          <p className="t-corpo font-semibold text-[#0f1117]">
            {itens.length === 0 ? "Nenhum produto ainda" : "Nada encontrado"}
          </p>
          <p className="t-corpo text-[#9ca3af] mt-1">
            {itens.length === 0
              ? "Cadastre produtos em Produtos para controlar o estoque aqui."
              : "Tente outro termo ou troque de filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 anim-lista">
          {filtrados.map((i) => {
            const v = VISUAL[i.situacao];
            const emEdicao = editando === i.id;

            return (
              <div key={i.id} className="cartao-app p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="t-corpo font-semibold text-[#0f1117] leading-snug">
                      {i.nome}
                    </p>
                    <p className="t-apoio text-[#9ca3af] mt-0.5">
                      {[i.sku, i.categoria].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <span
                      className={`t-apoio mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border ${v.cor}`}
                    >
                      {v.icone}
                      {v.rotulo}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {emEdicao ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          inputMode="numeric"
                          autoFocus
                          className="t-secao w-20 h-10 px-2 text-center rounded-lg border border-[#0f1117] font-bold outline-none tabular-nums"
                        />
                        <button
                          onClick={() => salvar(i)}
                          disabled={salvando !== null}
                          aria-label="Salvar"
                          className="toque w-10 h-10 rounded-lg bg-[#0f1117] text-white flex items-center justify-center disabled:opacity-50"
                        >
                          {salvando === i.id ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <Check size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          aria-label="Cancelar"
                          className="toque w-10 h-10 rounded-lg bg-[#f4f4f5] flex items-center justify-center"
                        >
                          <X size={15} className="text-[#374151]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditando(i.id);
                          setValor(String(i.estoque));
                        }}
                        className="sem-toque-minimo inline-flex items-center gap-1.5"
                      >
                        <span className="t-titulo font-bold text-[#0f1117] tabular-nums">
                          {i.estoque}
                        </span>
                        <Pencil size={13} className="text-[#9ca3af]" />
                      </button>
                    )}

                    {!emEdicao && (
                      <p className="t-apoio text-[#9ca3af] mt-0.5">
                        mínimo {i.minimo} · {brl(i.preco)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

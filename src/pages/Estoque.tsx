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
  ChevronDown,
  Layers,
} from "lucide-react";
import {
  ajustarEstoque,
  ajustarEstoqueVariacao,
  listarEstoque,
  type ItemEstoque,
  type SituacaoEstoque,
  type VariacaoEstoque,
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

  /**
   * Produtos com a grade aberta. Fechada por padrão: uma loja com 40
   * produtos de 15 combinações cada viraria uma lista de 600 linhas
   * logo na entrada da tela.
   */
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  function alternar(id: string) {
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // A chave da edição é o id do produto OU o da variação: as duas
  // coisas se editam no mesmo lugar, e só uma por vez.
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

  async function salvar(id: string, ehVariacao: boolean) {
    setSalvando(id);
    setErro(null);
    try {
      if (ehVariacao) await ajustarEstoqueVariacao(id, Number(valor));
      else await ajustarEstoque(id, Number(valor));
      // Recarrega inteiro: o total do produto é recalculado pelo
      // banco a partir da grade, então adivinhar aqui erraria.
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
      /*
       * O filtro olha a GAVETA, não só o total.
       *
       * "Sem estoque" que ignora a grade é inútil para quem repõe
       * roupa: um produto com 40 peças no total e zero na P preta
       * precisa de compra, e ficava escondido atrás do número bonito.
       */
      if (filtro !== "todos") {
        const casa = i.temGrade
          ? i.situacao === filtro || i.variacoes.some((v) => v.situacao === filtro)
          : i.situacao === filtro;
        if (!casa) return false;
      }
      if (!termo) return true;
      return (
        i.nome.toLowerCase().includes(termo) ||
        (i.sku ?? "").toLowerCase().includes(termo) ||
        (i.categoria ?? "").toLowerCase().includes(termo) ||
        // Procurar por "Preto" ou pelo SKU da gaveta também acha.
        i.variacoes.some(
          (v) =>
            v.nome.toLowerCase().includes(termo) ||
            (v.sku ?? "").toLowerCase().includes(termo),
        )
      );
    });
  }, [itens, busca, filtro]);

  /**
   * Contagem pela MESMA régua do filtro.
   *
   * Se o número da etiqueta contar só o total do produto e o filtro
   * contar a gaveta, a etiqueta diz "2" e a lista mostra 5. Um
   * produto entra em cada situação no máximo uma vez, mesmo tendo
   * dez gavetas zeradas — o que se repõe é o produto.
   */
  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: itens.length };
    itens.forEach((i) => {
      const situacoes = new Set<SituacaoEstoque>([i.situacao]);
      if (i.temGrade) i.variacoes.forEach((v) => situacoes.add(v.situacao));
      situacoes.forEach((sit) => {
        c[sit] = (c[sit] ?? 0) + 1;
      });
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

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span
                        className={`t-apoio inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border ${v.cor}`}
                      >
                        {v.icone}
                        {v.rotulo}
                      </span>

                      {/* O número do total esconde o que importa numa
                          loja de roupa: 40 peças com a P preta zerada
                          continuam sendo uma venda perdida. */}
                      {i.temGrade && i.gavetasSemPeca > 0 && (
                        <span className="t-apoio inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]">
                          <XCircle size={13} />
                          {i.gavetasSemPeca} sem peça
                        </span>
                      )}
                      {i.temGrade && i.gavetasAcabando > 0 && (
                        <span className="t-apoio inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border bg-[#fffbeb] text-[#b45309] border-[#fde68a]">
                          <AlertTriangle size={13} />
                          {i.gavetasAcabando} acabando
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {/* Com grade o total é SÓ LEITURA: quem manda são
                        as gavetas, e o banco recalcula a soma. Campo
                        editável aqui aceitaria o número e o devolveria
                        trocado no recarregamento. */}
                    {i.temGrade ? (
                      <button
                        onClick={() => alternar(i.id)}
                        aria-expanded={abertos.has(i.id)}
                        className="sem-toque-minimo inline-flex items-center gap-1.5"
                      >
                        <span className="t-titulo font-bold text-[#0f1117] tabular-nums">
                          {i.estoque}
                        </span>
                        <ChevronDown
                          size={15}
                          className={`text-[#9ca3af] transition-transform ${
                            abertos.has(i.id) ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    ) : emEdicao ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          inputMode="numeric"
                          autoFocus
                          className="t-secao w-20 h-10 px-2 text-center rounded-lg border border-[#0f1117] font-bold outline-none tabular-nums"
                        />
                        <button
                          onClick={() => salvar(i.id, false)}
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
                        {i.temGrade
                          ? `${i.variacoes.length} ${
                              i.variacoes.length === 1 ? "combinação" : "combinações"
                            } · ${brl(i.preco)}`
                          : `mínimo ${i.minimo} · ${brl(i.preco)}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* As gavetas */}
                {i.temGrade && abertos.has(i.id) && (
                  <div className="mt-3 pt-3 border-t border-[#f4f4f5] space-y-1.5">
                    <p className="t-apoio text-[#9ca3af] flex items-center gap-1.5 mb-2">
                      <Layers size={13} />
                      O total acima é a soma destas combinações
                    </p>

                    {i.variacoes.map((g: VariacaoEstoque) => {
                      const vg = VISUAL[g.situacao];
                      const editandoGaveta = editando === g.id;

                      return (
                        <div
                          key={g.id}
                          className="flex items-center gap-2.5 py-1.5"
                        >
                          <span
                            className={`t-apoio shrink-0 w-2 h-2 rounded-full ${
                              g.situacao === "sem"
                                ? "bg-[#dc2626]"
                                : g.situacao === "baixo"
                                  ? "bg-[#d97706]"
                                  : "bg-[#16a34a]"
                            }`}
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0">
                            <p className="t-corpo text-[#0f1117] truncate">
                              {g.nome}
                            </p>
                            {g.sku && (
                              <p className="t-apoio text-[#9ca3af] truncate">
                                {g.sku}
                              </p>
                            )}
                          </div>

                          <span className="sr-only">{vg.rotulo}</span>

                          {editandoGaveta ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                value={valor}
                                onChange={(e) => setValor(e.target.value)}
                                inputMode="numeric"
                                autoFocus
                                className="t-corpo w-16 h-9 px-2 text-center rounded-lg border border-[#0f1117] font-bold outline-none tabular-nums"
                              />
                              <button
                                onClick={() => salvar(g.id, true)}
                                disabled={salvando !== null}
                                aria-label={`Salvar ${g.nome}`}
                                className="toque w-9 h-9 rounded-lg bg-[#0f1117] text-white flex items-center justify-center disabled:opacity-50"
                              >
                                {salvando === g.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => setEditando(null)}
                                aria-label="Cancelar"
                                className="toque w-9 h-9 rounded-lg bg-[#f4f4f5] flex items-center justify-center"
                              >
                                <X size={14} className="text-[#374151]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditando(g.id);
                                setValor(String(g.estoque));
                              }}
                              aria-label={`Editar estoque de ${g.nome}`}
                              className="sem-toque-minimo inline-flex items-center gap-1.5 shrink-0"
                            >
                              <span
                                className={`t-corpo font-bold tabular-nums ${
                                  g.estoque < 0
                                    ? "text-[#b91c1c]"
                                    : g.situacao === "sem"
                                      ? "text-[#b91c1c]"
                                      : "text-[#0f1117]"
                                }`}
                              >
                                {g.estoque}
                              </span>
                              <Pencil size={12} className="text-[#9ca3af]" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

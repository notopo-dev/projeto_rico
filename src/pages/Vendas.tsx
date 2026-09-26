import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingBag,
  Receipt,
  Package,
  Users,
  CreditCard,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  getMelhoresClientes,
  getProdutosVendidos,
  getReceitaPorPeriodo,
  getResumoVendas,
  getVendasPorPagamento,
  type LinhaCliente,
  type LinhaPagamento,
  type LinhaProduto,
  type Periodo,
  type PontoGrafico,
  type ResumoVendas,
} from "../lib/relatoriosApi";
import { CartoesCarregando, ListaCarregando } from "../components/Carregando";

/**
 * Relatórios de vendas, com dados reais do banco.
 *
 * Antes esta tela tinha os números escritos no próprio código —
 * mostrava sempre a mesma coisa, independente das vendas.
 */

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "12m", rotulo: "12 meses" },
];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const pct = variacao(atual, anterior);
  const igual = Math.abs(pct) < 0.5;

  const Icone = igual ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  const cor = igual
    ? "text-[#9ca3af]"
    : pct > 0
    ? "text-[#16a34a]"
    : "text-[#b91c1c]";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${cor}`}
    >
      <Icone size={12} strokeWidth={2.2} />
      {igual ? "estável" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
    </span>
  );
}

function Cartao({
  titulo,
  valor,
  atual,
  anterior,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  atual: number;
  anterior: number;
  icone: React.ElementType;
}) {
  return (
    <div className="cartao-app p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-[#6b7280]">{titulo}</p>
        <Icone size={15} className="text-[#9ca3af] shrink-0" />
      </div>
      <p className="text-[22px] font-extrabold text-[#0f1117] mt-1.5 leading-none">
        {valor}
      </p>
      <div className="mt-2">
        <Variacao atual={atual} anterior={anterior} />
        <span className="text-[11px] text-[#9ca3af] ml-1.5">
          vs. período anterior
        </span>
      </div>
    </div>
  );
}

/** Barras horizontais: legíveis no celular, ao contrário de eixos apertados. */
function Grafico({ pontos }: { pontos: PontoGrafico[] }) {
  const maior = Math.max(...pontos.map((p) => p.valor), 1);
  const temVenda = pontos.some((p) => p.valor > 0);

  if (!temVenda) {
    return (
      <p className="text-[13px] text-[#9ca3af] py-10 text-center">
        Nenhuma venda registrada neste período.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {pontos.map((p) => (
        <div key={p.rotulo} className="flex items-center gap-2.5">
          <span className="text-[11px] text-[#9ca3af] w-12 shrink-0 tabular-nums">
            {p.rotulo}
          </span>
          <div className="flex-1 h-6 bg-[#f4f4f5] rounded-lg overflow-hidden">
            <div
              className="h-full bg-[#0f1117] rounded-lg transition-all duration-500"
              style={{
                width: `${Math.max(
                  (p.valor / maior) * 100,
                  p.valor > 0 ? 3 : 0
                )}%`,
              }}
            />
          </div>
          <span className="text-[11.5px] font-medium text-[#374151] w-20 text-right shrink-0 tabular-nums">
            {p.valor > 0 ? brl(p.valor) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Secao({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: string;
  icone: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="cartao-app">
      <div className="px-4 py-3 border-b border-[#e7e7ea] flex items-center gap-2">
        <Icone size={15} className="text-[#6b7280]" />
        <h2 className="text-[13px] font-semibold text-[#0f1117]">{titulo}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-[13px] text-[#9ca3af] py-8 text-center">{texto}</p>;
}

export default function Vendas() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");

  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const [grafico, setGrafico] = useState<PontoGrafico[]>([]);
  const [produtos, setProdutos] = useState<LinhaProduto[]>([]);
  const [pagamentos, setPagamentos] = useState<LinhaPagamento[]>([]);
  const [clientes, setClientes] = useState<LinhaCliente[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(p: Periodo) {
    setCarregando(true);
    setErro(null);
    try {
      const [r, g, prod, pag, cli] = await Promise.all([
        getResumoVendas(p),
        getReceitaPorPeriodo(p),
        getProdutosVendidos(p),
        getVendasPorPagamento(p),
        getMelhoresClientes(p),
      ]);
      setResumo(r);
      setGrafico(g);
      setProdutos(prod);
      setPagamentos(pag);
      setClientes(cli);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar os dados."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(periodo);
  }, [periodo]);

  const totalPagamentos = pagamentos.reduce((s, x) => s + x.receita, 0);

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-4">
      {/* Período */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {PERIODOS.map(({ id, rotulo }) => (
            <button
              key={id}
              onClick={() => setPeriodo(id)}
              className={`btn-app-pequeno shrink-0 border ${
                periodo === id
                  ? "bg-[#0f1117] text-white border-[#0f1117]"
                  : "bg-white text-[#374151] border-[#e7e7ea]"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <button
          onClick={() => carregar(periodo)}
          disabled={carregando}
          className="btn-app-pequeno bg-white border border-[#e7e7ea] text-[#6b7280] disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-[#b91c1c] break-words">{erro}</p>
            <button
              onClick={() => carregar(periodo)}
              className="text-[12px] font-semibold text-[#991b1b] underline mt-1"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <>
          <CartoesCarregando quantidade={4} />
          <ListaCarregando linhas={4} />
        </>
      ) : (
        <>
          {resumo && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 anim-lista">
              <Cartao
                titulo="Receita"
                valor={brl(resumo.receita)}
                atual={resumo.receita}
                anterior={resumo.receitaAnterior}
                icone={Receipt}
              />
              <Cartao
                titulo="Pedidos"
                valor={String(resumo.pedidos)}
                atual={resumo.pedidos}
                anterior={resumo.pedidosAnterior}
                icone={ShoppingBag}
              />
              <Cartao
                titulo="Ticket médio"
                valor={brl(resumo.ticketMedio)}
                atual={resumo.ticketMedio}
                anterior={resumo.ticketMedioAnterior}
                icone={TrendingUp}
              />
              <Cartao
                titulo="Itens vendidos"
                valor={String(resumo.itensVendidos)}
                atual={resumo.itensVendidos}
                anterior={resumo.itensVendidosAnterior}
                icone={Package}
              />
            </div>
          )}

          <Secao titulo="Receita no período" icone={TrendingUp}>
            <Grafico pontos={grafico} />
          </Secao>

          <Secao titulo="Produtos mais vendidos" icone={Package}>
            {produtos.length === 0 ? (
              <Vazio texto="Nenhum produto vendido neste período." />
            ) : (
              <div className="space-y-2">
                {produtos.map((p, i) => (
                  <div
                    key={`${p.sku}-${i}`}
                    className="flex items-center gap-3 py-1"
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#f4f4f5] text-[11px] font-bold text-[#6b7280] flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0f1117] truncate">
                        {p.nome}
                      </p>
                      <p className="text-[11.5px] text-[#9ca3af]">
                        {p.unidades} {p.unidades === 1 ? "unidade" : "unidades"}
                        {p.sku !== "—" && ` · ${p.sku}`}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#0f1117] shrink-0 tabular-nums">
                      {brl(p.receita)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          <Secao titulo="Formas de pagamento" icone={CreditCard}>
            {pagamentos.length === 0 ? (
              <Vazio texto="Nenhum pagamento neste período." />
            ) : (
              <div className="space-y-2.5">
                {pagamentos.map((p) => {
                  const pct = totalPagamentos
                    ? (p.receita / totalPagamentos) * 100
                    : 0;
                  return (
                    <div key={p.metodo}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[13px] text-[#0f1117]">
                          {p.metodo}
                        </span>
                        <span className="text-[12.5px] text-[#6b7280] tabular-nums">
                          {brl(p.receita)}
                          <span className="text-[#9ca3af] ml-1.5">
                            {pct.toFixed(0)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0f1117] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Secao>

          <Secao titulo="Clientes que mais compraram" icone={Users}>
            {clientes.length === 0 ? (
              <Vazio texto="Nenhum cliente com compras neste período." />
            ) : (
              <div className="space-y-2">
                {clientes.map((c, i) => (
                  <div
                    key={`${c.nome}-${i}`}
                    className="flex items-center gap-3 py-1"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0f1117] truncate">
                        {c.nome}
                      </p>
                      <p className="text-[11.5px] text-[#9ca3af]">
                        {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}
                        {c.ultimaCompra &&
                          ` · última em ${new Date(
                            c.ultimaCompra
                          ).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#0f1117] shrink-0 tabular-nums">
                      {brl(c.receita)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}

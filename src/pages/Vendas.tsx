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
  MapPin,
  UserPlus,
  Truck,
} from "lucide-react";
import {
  getClientesNovosRecorrentes,
  getMelhoresClientes,
  getProdutosVendidos,
  getReceitaPorPeriodo,
  getResumoFrete,
  getResumoVendas,
  getVendasPorPagamento,
  getVendasPorRegiao,
  type ClientesNovosRecorrentes,
  type LinhaCliente,
  type LinhaPagamento,
  type LinhaProduto,
  type LinhaRegiao,
  type Periodo,
  type PontoGrafico,
  type ResumoFrete,
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
      className={`t-apoio inline-flex items-center gap-1 font-medium ${cor}`}
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
        <p className="t-corpo text-[#6b7280]">{titulo}</p>
        <Icone size={15} className="text-[#9ca3af] shrink-0" />
      </div>
      <p className="t-titulo font-extrabold text-[#0f1117] mt-1.5 leading-none">
        {valor}
      </p>
      <div className="mt-2">
        <Variacao atual={atual} anterior={anterior} />
        <span className="t-apoio text-[#9ca3af] ml-1.5">
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
      <p className="t-corpo text-[#9ca3af] py-10 text-center">
        Nenhuma venda registrada neste período.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {pontos.map((p) => (
        <div key={p.rotulo} className="flex items-center gap-2.5">
          <span className="t-apoio text-[#9ca3af] w-12 shrink-0 tabular-nums">
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
          <span className="t-apoio font-medium text-[#374151] w-20 text-right shrink-0 tabular-nums">
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
        <h2 className="t-corpo font-semibold text-[#0f1117]">{titulo}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="t-corpo text-[#9ca3af] py-8 text-center">{texto}</p>;
}

export default function Vendas() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");

  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const [grafico, setGrafico] = useState<PontoGrafico[]>([]);
  const [produtos, setProdutos] = useState<LinhaProduto[]>([]);
  const [pagamentos, setPagamentos] = useState<LinhaPagamento[]>([]);
  const [clientes, setClientes] = useState<LinhaCliente[]>([]);
  const [regioes, setRegioes] = useState<LinhaRegiao[]>([]);
  const [recorrencia, setRecorrencia] =
    useState<ClientesNovosRecorrentes | null>(null);
  const [frete, setFrete] = useState<ResumoFrete | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar(p: Periodo) {
    setCarregando(true);
    setErro(null);
    try {
      const [r, g, prod, pag, cli, reg, rec, fre] = await Promise.all([
        getResumoVendas(p),
        getReceitaPorPeriodo(p),
        getProdutosVendidos(p),
        getVendasPorPagamento(p),
        getMelhoresClientes(p),
        getVendasPorRegiao(p),
        getClientesNovosRecorrentes(p),
        getResumoFrete(p),
      ]);
      setResumo(r);
      setGrafico(g);
      setProdutos(prod);
      setPagamentos(pag);
      setClientes(cli);
      setRegioes(reg);
      setRecorrencia(rec);
      setFrete(fre);
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
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="t-corpo text-[#b91c1c] break-words">{erro}</p>
            <button
              onClick={() => carregar(periodo)}
              className="t-corpo font-semibold text-[#991b1b] underline mt-1"
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
                    <span className="t-apoio w-6 h-6 rounded-lg bg-[#f4f4f5] font-bold text-[#6b7280] flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="t-corpo font-medium text-[#0f1117] truncate">
                        {p.nome}
                      </p>
                      <p className="t-apoio text-[#9ca3af]">
                        {p.unidades} {p.unidades === 1 ? "unidade" : "unidades"}
                        {p.sku !== "—" && ` · ${p.sku}`}
                      </p>
                    </div>
                    <span className="t-corpo font-semibold text-[#0f1117] shrink-0 tabular-nums">
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
                        <span className="t-corpo text-[#0f1117]">
                          {p.metodo}
                        </span>
                        <span className="t-corpo text-[#6b7280] tabular-nums">
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
                      <p className="t-corpo font-medium text-[#0f1117] truncate">
                        {c.nome}
                      </p>
                      <p className="t-apoio text-[#9ca3af]">
                        {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}
                        {c.ultimaCompra &&
                          ` · última em ${new Date(
                            c.ultimaCompra
                          ).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <span className="t-corpo font-semibold text-[#0f1117] shrink-0 tabular-nums">
                      {brl(c.receita)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Secao>

          {/* ----------------------------------------------------
              VENDAS POR ESTADO
              A UF vem do endereço de entrega gravado no pedido.
              Pedido sem UF aparece como "Não informado" em vez de
              ser descartado, para a soma fechar com o topo.
          ---------------------------------------------------- */}
          <Secao titulo="Vendas por estado" icone={MapPin}>
            {regioes.length === 0 ? (
              <Vazio texto="Nenhuma venda com endereço neste período." />
            ) : (
              <div className="space-y-2.5">
                {regioes.map((r) => {
                  const maior = regioes[0]?.receita || 1;
                  const pct = (r.receita / maior) * 100;
                  return (
                    <div key={r.uf}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="t-corpo text-[#0f1117]">{r.uf}</span>
                        <span className="t-corpo text-[#6b7280] tabular-nums">
                          {brl(r.receita)}
                          <span className="text-[#9ca3af] ml-1.5">
                            {r.pedidos} {r.pedidos === 1 ? "pedido" : "pedidos"}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16a34a] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Secao>

          {/* ----------------------------------------------------
              NOVOS x RECORRENTES
              Conta GENTE, não pedido: um cliente com três compras
              no período entra uma vez só.
          ---------------------------------------------------- */}
          <Secao titulo="Clientes novos e recorrentes" icone={UserPlus}>
            {!recorrencia ||
            (recorrencia.novos === 0 && recorrencia.recorrentes === 0) ? (
              <Vazio texto="Nenhum cliente cadastrado comprou neste período." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="painel-app px-3.5 py-3">
                    <p className="t-apoio text-[#6b7280]">Novos</p>
                    <p className="t-numero text-[#0f1117] mt-0.5">
                      {recorrencia.novos}
                    </p>
                    <p className="t-micro text-[#9ca3af] mt-1">
                      {brl(recorrencia.receitaNovos)}
                    </p>
                  </div>
                  <div className="painel-app px-3.5 py-3">
                    <p className="t-apoio text-[#6b7280]">Voltaram a comprar</p>
                    <p className="t-numero text-[#15803d] mt-0.5">
                      {recorrencia.recorrentes}
                    </p>
                    <p className="t-micro text-[#9ca3af] mt-1">
                      {brl(recorrencia.receitaRecorrentes)}
                    </p>
                  </div>
                </div>

                {recorrencia.semCadastro > 0 && (
                  <p className="t-apoio text-[#9ca3af] leading-snug mt-3">
                    {recorrencia.semCadastro}{" "}
                    {recorrencia.semCadastro === 1 ? "pedido" : "pedidos"} sem
                    cliente cadastrado ficaram fora desta conta — sem cadastro
                    não há como saber se a pessoa já havia comprado.
                  </p>
                )}
              </>
            )}
          </Secao>

          {/* ----------------------------------------------------
              FRETE
              "Cobrado", não "custo": este é o valor que o cliente
              pagou. Quanto a transportadora cobra do lojista não
              está no banco, então não é prometido aqui.
          ---------------------------------------------------- */}
          <Secao titulo="Frete cobrado" icone={Truck}>
            {!frete || frete.porTransportadora.length === 0 ? (
              <Vazio texto="Nenhum pedido neste período." />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="painel-app px-3.5 py-3">
                    <p className="t-apoio text-[#6b7280]">Total cobrado</p>
                    <p className="t-corpo-forte text-[#0f1117] numeros mt-1">
                      {brl(frete.totalCobrado)}
                    </p>
                  </div>
                  <div className="painel-app px-3.5 py-3">
                    <p className="t-apoio text-[#6b7280]">Frete médio</p>
                    <p className="t-corpo-forte text-[#0f1117] numeros mt-1">
                      {brl(frete.freteMedio)}
                    </p>
                  </div>
                  <div className="painel-app px-3.5 py-3 col-span-2 sm:col-span-1">
                    <p className="t-apoio text-[#6b7280]">Enviados de graça</p>
                    <p className="t-corpo-forte text-[#0f1117] numeros mt-1">
                      {frete.pedidosFreteGratis}
                    </p>
                  </div>
                </div>

                <div className="mt-3 lista-linhas border-t border-[#e7e7ea]">
                  {frete.porTransportadora.map((t) => (
                    <div
                      key={t.nome}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span className="t-corpo text-[#0f1117] truncate">
                        {t.nome}
                      </span>
                      <span className="t-corpo text-[#6b7280] tabular-nums shrink-0">
                        {brl(t.total)}
                        <span className="text-[#9ca3af] ml-1.5">
                          {t.pedidos}{" "}
                          {t.pedidos === 1 ? "pedido" : "pedidos"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Ticket,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import Folha from "../components/Folha";
import Interruptor from "../components/Interruptor";
import {
  listarCupons,
  criarCupom,
  atualizarCupom,
  alternarCupom,
  apagarCupom,
  normalizarCodigo,
  type Cupom,
  type CupomInput,
  type TipoCupom,
} from "../lib/cuponsApi";

/**
 * Cupons de desconto.
 *
 * ----------------------------------------------------------------
 * Datas por DIA, não por instante
 * ----------------------------------------------------------------
 * O lojista pensa "vale até dia 31". Se a validade fosse gravada às
 * 00:00 do dia 31, o cupom morreria na virada do dia 30 para o 31 e
 * o dia inteiro anunciado estaria perdido — com cliente reclamando.
 *
 * Então: início vira 00:00 e fim vira 23:59:59 do dia escolhido, no
 * fuso de quem está preenchendo.
 */

function inicioDoDia(data: string): string | null {
  if (!data) return null;
  return new Date(`${data}T00:00:00`).toISOString();
}

function fimDoDia(data: string): string | null {
  if (!data) return null;
  return new Date(`${data}T23:59:59.999`).toISOString();
}

function paraCampoData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Uma linha de texto que resume as condições do cupom. */
function condicoes(c: Cupom): string {
  const partes: string[] = [];

  if (c.minimo_compra) partes.push(`a partir de ${reais(c.minimo_compra)}`);
  if (c.frete_gratis) partes.push("com frete grátis");
  if (c.limite_total) partes.push(`até ${c.limite_total} usos`);
  if (c.limite_por_cliente === 1) partes.push("1 por cliente");
  else if (c.limite_por_cliente)
    partes.push(`${c.limite_por_cliente} por cliente`);

  if (c.expira_em) {
    const venceu = new Date(c.expira_em) < new Date();
    partes.push(
      `${venceu ? "venceu" : "até"} ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`,
    );
  }

  return partes.length ? partes.join(" · ") : "sem condições";
}

const VAZIO: CupomInput = {
  codigo: "",
  tipo: "percentual",
  valor: 10,
  minimo_compra: null,
  frete_gratis: false,
  comeca_em: null,
  expira_em: null,
  limite_total: null,
  limite_por_cliente: null,
  ativo: true,
};

export default function Cupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Cupom | null>(null);
  const [apagando, setApagando] = useState<Cupom | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [form, setForm] = useState<CupomInput>(VAZIO);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setCupons(await listarCupons());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os cupons.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setForm(VAZIO);
    setDataInicio("");
    setDataFim("");
    setErroForm(null);
    setAberto(true);
  }

  function abrirEdicao(c: Cupom) {
    setEditando(c);
    setForm({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor,
      minimo_compra: c.minimo_compra,
      frete_gratis: c.frete_gratis,
      comeca_em: c.comeca_em,
      expira_em: c.expira_em,
      limite_total: c.limite_total,
      limite_por_cliente: c.limite_por_cliente,
      ativo: c.ativo,
    });
    setDataInicio(paraCampoData(c.comeca_em));
    setDataFim(paraCampoData(c.expira_em));
    setErroForm(null);
    setAberto(true);
  }

  /** O que falta preencher, ou null. */
  function oQueFalta(): string | null {
    if (normalizarCodigo(form.codigo).length < 3) {
      return "O código precisa ter pelo menos 3 letras.";
    }
    if (!Number.isFinite(form.valor) || form.valor <= 0) {
      return "O desconto precisa ser maior que zero.";
    }
    if (form.tipo === "percentual" && form.valor > 100) {
      return "Desconto em porcentagem não pode passar de 100%.";
    }
    if (dataInicio && dataFim && dataFim < dataInicio) {
      return "A data de fim precisa ser depois da data de início.";
    }
    return null;
  }

  async function salvar() {
    const falta = oQueFalta();
    if (falta) {
      setErroForm(falta);
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      const dados: CupomInput = {
        ...form,
        comeca_em: inicioDoDia(dataInicio),
        expira_em: fimDoDia(dataFim),
      };

      if (editando) await atualizarCupom(editando.id, dados);
      else await criarCupom(dados);

      setAberto(false);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(c: Cupom, ativo: boolean) {
    // Otimista: o interruptor responde na hora. Se o servidor recusar,
    // recarrega e volta ao estado de verdade.
    setCupons((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, ativo } : x)),
    );
    try {
      await alternarCupom(c.id, ativo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
      carregar();
    }
  }

  async function confirmarApagar() {
    if (!apagando) return;
    try {
      await apagarCupom(apagando.id);
      setCupons((prev) => prev.filter((x) => x.id !== apagando.id));
      setApagando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar.");
      setApagando(null);
    }
  }

  const campo =
    "t-corpo w-full h-11 px-3 rounded-lg border border-[#e4e4e7] bg-white " +
    "text-[#111827] outline-none focus:border-[#16a34a] " +
    "focus:ring-2 focus:ring-[#16a34a]/10 transition lg:h-10";

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[900px] lg:px-6 lg:py-6">
      {/* O botão NÃO usa `.btn-app`.
          Aquela classe tem `width: 100%`, e ela vive numa folha sem
          camada — então vence o `w-auto` do Tailwind, que vem da
          camada de utilitários. O botão esticava e esmagava o título
          numa coluna de 90px. As outras telas do painel (Produtos,
          Categorias) escrevem as classes à mão por este motivo, e
          aqui faço igual. */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-titulo font-bold text-[#0f1117]">Cupons</h1>
          <p className="t-corpo mt-1 leading-snug text-[#6b7280]">
            O cliente digita o código no checkout e o desconto é calculado
            aqui no sistema — nunca no navegador dele.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNovo}
          className="t-corpo flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#16a34a] px-3.5 font-semibold text-white shadow-sm transition-transform active:scale-[0.98] lg:h-9 lg:rounded-[6px] lg:px-3"
        >
          <Plus size={16} />
          {/* No celular estreito sobra o sinal de mais, que já é
              entendido — o rótulo inteiro empurrava o título. */}
          <span className="hidden sm:inline">Novo cupom</span>
        </button>
      </div>

      {erro && (
        <div className="t-corpo mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 text-[#b91c1c]">
          <span>{erro}</span>
          <button onClick={carregar} className="shrink-0 font-semibold underline">
            Tentar novamente
          </button>
        </div>
      )}

      {carregando && (
        <div className="t-corpo flex items-center gap-2 text-[#6b7280]">
          <Loader2 size={14} className="animate-spin" />
          Carregando...
        </div>
      )}

      {!carregando && cupons.length === 0 && (
        <div className="cartao-app px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f0fdf4]">
            <Ticket size={20} className="text-[#16a34a]" strokeWidth={1.8} />
          </div>
          <p className="t-corpo-forte text-[#0f1117]">Nenhum cupom ainda</p>
          <p className="t-apoio mx-auto mt-1 max-w-[42ch] leading-snug text-[#6b7280]">
            Cupom é o que faz campanha de Instagram converter: a pessoa vê o
            código no story e usa na mesma hora.
          </p>
        </div>
      )}

      {cupons.length > 0 && (
        <div className="cartao-app divide-y divide-[#e7e7ea]">
          {cupons.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="t-corpo-forte font-mono tracking-wide text-[#0f1117]">
                    {c.codigo}
                  </span>
                  <span className="t-micro rounded-full bg-[#f0fdf4] px-2 py-0.5 font-semibold text-[#15803d]">
                    {c.tipo === "percentual"
                      ? `${c.valor}% off`
                      : `${reais(c.valor)} off`}
                  </span>
                </div>
                <p className="t-apoio mt-0.5 truncate text-[#6b7280]">
                  {condicoes(c)}
                </p>
                <p className="t-micro mt-0.5 text-[#9ca3af]">
                  {c.usos === 0
                    ? "nunca usado"
                    : c.usos === 1
                      ? "usado 1 vez"
                      : `usado ${c.usos} vezes`}
                </p>
              </div>

              <Interruptor
                ligado={c.ativo}
                onAlternar={(v) => alternar(c, v)}
                rotulo={`Cupom ${c.codigo} ativo`}
              />

              <button
                type="button"
                onClick={() => abrirEdicao(c)}
                aria-label={`Editar ${c.codigo}`}
                className="toque flex items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f4f4f5]"
              >
                <Pencil size={16} />
              </button>

              {/* Apagar só aparece para cupom nunca usado: apagar um
                  cupom já usado tira do histórico a explicação do
                  desconto daquele pedido. */}
              {c.usos === 0 && (
                <button
                  type="button"
                  onClick={() => setApagando(c)}
                  aria-label={`Apagar ${c.codigo}`}
                  className="toque flex items-center justify-center rounded-lg text-[#b91c1c] hover:bg-[#fef2f2]"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- formulário ---------------- */}
      <Folha
        aberta={aberto}
        onFechar={() => setAberto(false)}
        titulo={editando ? "Editar cupom" : "Novo cupom"}
        rodape={
          <>
            <button
              onClick={() => setAberto(false)}
              className="t-corpo h-11 flex-1 rounded-lg border border-[#e4e4e7] bg-white font-medium text-[#374151]"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="t-corpo flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#16a34a] font-semibold text-white disabled:opacity-60"
            >
              {salvando && <Loader2 size={15} className="animate-spin" />}
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label htmlFor="cupom-codigo" className="t-apoio mb-1 block font-medium text-[#374151]">
              Código
            </label>
            <input
              id="cupom-codigo"
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              placeholder="VERAO10"
              autoCapitalize="characters"
              className={campo + " font-mono uppercase tracking-wide"}
            />
            <p className="t-micro mt-1 text-[#6b7280]">
              É isto que a cliente digita. Maiúsculas e minúsculas dão no mesmo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cupom-tipo" className="t-apoio mb-1 block font-medium text-[#374151]">
                Tipo
              </label>
              <select
                id="cupom-tipo"
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value as TipoCupom }))
                }
                className={campo}
              >
                <option value="percentual">Porcentagem</option>
                <option value="valor">Valor em reais</option>
              </select>
            </div>

            <div>
              <label htmlFor="cupom-valor" className="t-apoio mb-1 block font-medium text-[#374151]">
                {form.tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
              </label>
              <input
                id="cupom-valor"
                type="number"
                inputMode="decimal"
                min={0}
                step={form.tipo === "percentual" ? 1 : 0.01}
                max={form.tipo === "percentual" ? 100 : undefined}
                value={form.valor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valor: Number(e.target.value) }))
                }
                className={campo}
              />
            </div>
          </div>

          <div>
            <label htmlFor="cupom-minimo" className="t-apoio mb-1 block font-medium text-[#374151]">
              Vale em compras a partir de (opcional)
            </label>
            <input
              id="cupom-minimo"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.minimo_compra ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  minimo_compra:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              placeholder="sem mínimo"
              className={campo}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e7e7ea] px-3 py-2.5">
            <div className="min-w-0">
              <p className="t-corpo font-medium text-[#0f1117]">Frete grátis</p>
              <p className="t-micro text-[#6b7280]">
                Zera a entrega junto com o desconto
              </p>
            </div>
            <Interruptor
              ligado={form.frete_gratis}
              onAlternar={(v) => setForm((f) => ({ ...f, frete_gratis: v }))}
              rotulo="Cupom dá frete grátis"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cupom-de" className="t-apoio mb-1 block font-medium text-[#374151]">
                Começa em (opcional)
              </label>
              <input
                id="cupom-de"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="cupom-ate" className="t-apoio mb-1 block font-medium text-[#374151]">
                Vale até (opcional)
              </label>
              <input
                id="cupom-ate"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={campo}
              />
              <p className="t-micro mt-1 text-[#6b7280]">
                O dia escolhido conta inteiro, até 23:59.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cupom-limite" className="t-apoio mb-1 block font-medium text-[#374151]">
                Limite de usos (opcional)
              </label>
              <input
                id="cupom-limite"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.limite_total ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    limite_total:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="sem limite"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="cupom-por-cliente" className="t-apoio mb-1 block font-medium text-[#374151]">
                Usos por cliente (opcional)
              </label>
              <input
                id="cupom-por-cliente"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.limite_por_cliente ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    limite_por_cliente:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="sem limite"
                className={campo}
              />
              <p className="t-micro mt-1 text-[#6b7280]">Contado pelo CPF.</p>
            </div>
          </div>

          {erroForm && (
            <p
              role="alert"
              className="t-apoio rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[#b91c1c]"
            >
              {erroForm}
            </p>
          )}
        </div>
      </Folha>

      {/* ---------------- confirmar apagar ---------------- */}
      <Folha
        aberta={Boolean(apagando)}
        onFechar={() => setApagando(null)}
        titulo="Apagar cupom?"
        rodape={
          <>
            <button
              onClick={() => setApagando(null)}
              className="t-corpo h-11 flex-1 rounded-lg border border-[#e4e4e7] bg-white font-medium text-[#374151]"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarApagar}
              className="t-corpo h-11 flex-1 rounded-lg bg-[#b91c1c] font-semibold text-white"
            >
              Apagar
            </button>
          </>
        }
      >
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#fef2f2]">
            <AlertTriangle size={20} className="text-[#b91c1c]" strokeWidth={1.8} />
          </div>
          <p className="t-corpo leading-5 text-[#6b7280]">
            O cupom{" "}
            <strong className="font-mono text-[#374151]">
              {apagando?.codigo}
            </strong>{" "}
            nunca foi usado e será removido.
          </p>
        </div>
      </Folha>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  RefreshCw,
  AlertCircle,
  MessageCircle,
  Mail,
} from "lucide-react";
import { listarClientes, type Cliente } from "../lib/clientesApi";
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

function apenasDigitos(v: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

function inicial(nome: string) {
  return nome.trim().charAt(0).toUpperCase() || "?";
}

export default function Customers() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");

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
              <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
                {t.rotulo}
              </p>
              <p className="text-[17px] font-bold text-[#0f1117] mt-1 tabular-nums">
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
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12.5px] text-[#b91c1c] break-words">{erro}</p>
            <button
              onClick={carregar}
              className="sem-toque-minimo text-[12px] font-semibold text-[#991b1b] underline mt-1"
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
          <p className="text-[14px] font-semibold text-[#0f1117]">
            {clientes.length === 0 ? "Nenhum cliente ainda" : "Nada encontrado"}
          </p>
          <p className="text-[12.5px] text-[#9ca3af] mt-1">
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
              <div key={c.id} className="cartao-app p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#f4f4f5] flex items-center justify-center text-[14px] font-bold text-[#374151]">
                    {inicial(c.nome)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#0f1117] truncate">
                      {c.nome}
                    </p>
                    {c.email && (
                      <p className="text-[12px] text-[#6b7280] truncate">
                        {c.email}
                      </p>
                    )}
                    {c.telefone && (
                      <p className="text-[12px] text-[#6b7280]">{c.telefone}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-[#0f1117] tabular-nums">
                      {brl(c.gasto)}
                    </p>
                    <p className="text-[11.5px] text-[#9ca3af]">
                      {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#f0f0f1] flex items-center justify-between gap-3">
                  <p className="text-[11.5px] text-[#9ca3af]">
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
                        className="sem-toque-minimo inline-flex items-center gap-1 text-[12px] font-semibold text-[#15803d]"
                      >
                        <MessageCircle size={13} />
                        WhatsApp
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="sem-toque-minimo inline-flex items-center gap-1 text-[12px] font-semibold text-[#374151]"
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
    </div>
  );
}

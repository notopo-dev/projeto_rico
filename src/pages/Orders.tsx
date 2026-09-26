import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Search,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  X,
  MapPin,
  Truck,
  ChevronRight,
  Check,
  Copy,
  Printer,
  Tag,
  Undo2,
  StickyNote,
  Radar,
  MessageCircle,
} from "lucide-react";
import {
  atualizarStatusPedido,
  buscarPedido,
  listarPedidos,
  reembolsarPedido,
  salvarCodigoRastreio,
  salvarObservacoes,
  MOTIVOS_DEVOLUCAO,
  PROXIMOS_STATUS,
  ROTULO_CURTO,
  ROTULO_PAGAMENTO,
  ROTULO_STATUS,
  type Pedido,
  type StatusPedido,
} from "../lib/pedidosApi";
import { gerarEtiqueta, rastrearPedidoAdmin } from "../lib/freteAdminApi";
import { ListaCarregando } from "../components/Carregando";

/**
 * Pedidos da loja — lista + painel de gestão.
 *
 * O painel de detalhe é a central do lojista: mudar status, gerar e
 * imprimir a etiqueta de envio, rastrear, devolver dinheiro, falar com
 * o cliente e anotar. Tudo que mexe em dinheiro ou em dado pessoal
 * passa por Edge Function autenticada — o navegador só pede.
 */

const TODOS = "todos";

const ABAS: { id: string; rotulo: string }[] = [
  { id: TODOS, rotulo: "Todos" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "pago", rotulo: "Pagos" },
  { id: "enviado", rotulo: "Enviados" },
  { id: "entregue", rotulo: "Entregues" },
  { id: "cancelado", rotulo: "Cancelados" },
  { id: "devolvido", rotulo: "Devolvidos" },
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

function dataCurta(iso: string) {
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function apenasDigitos(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

function enderecoEmLinhas(p: Pedido): string[] {
  const e = p.endereco_entrega;
  if (!e) return [];
  const linhas: string[] = [];

  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  if (rua) linhas.push(e.complemento ? `${rua} — ${e.complemento}` : rua);
  if (e.bairro) linhas.push(e.bairro);

  const cidade = [e.cidade, e.uf].filter(Boolean).join(" / ");
  const cep = e.cep ?? p.cep_entrega;
  if (cidade || cep) linhas.push([cidade, cep].filter(Boolean).join(" · "));

  return linhas;
}

/** Copia sem depender só da API nova, que exige HTTPS e permissão. */
async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai no plano B */
  }
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function Etiqueta({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${CORES_STATUS[status]}`}
    >
      {ROTULO_CURTO[status]}
    </span>
  );
}

function Secao({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="cartao-app p-3.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
          {titulo}
        </p>
        {acao}
      </div>
      {children}
    </div>
  );
}

/* ---------------------- comprovante para imprimir ---------------------- */

/**
 * Fica escondido na página e só aparece na impressão (regra em index.css).
 * Evita abrir aba nova, que o bloqueador de pop-up do celular barra.
 */
function Comprovante({ pedido }: { pedido: Pedido }) {
  const subtotal = pedido.total - pedido.frete;
  const linhas = enderecoEmLinhas(pedido);

  return (
    <div className="area-impressao">
      <h1 style={{ fontSize: "18pt", margin: 0 }}>Pedido #{pedido.numero}</h1>
      <p style={{ margin: "4px 0 16px" }}>{dataHora(pedido.created_at)}</p>

      <p style={{ margin: "0 0 4px" }}>
        <strong>Situação:</strong> {ROTULO_STATUS[pedido.status]}
        {pedido.metodo_pagamento
          ? ` · ${
              ROTULO_PAGAMENTO[pedido.metodo_pagamento] ??
              pedido.metodo_pagamento
            }`
          : ""}
      </p>

      <h2 style={{ fontSize: "13pt", margin: "16px 0 4px" }}>Destinatário</h2>
      <p style={{ margin: 0 }}>{pedido.cliente_nome ?? "Sem cadastro"}</p>
      {pedido.cliente_telefone && (
        <p style={{ margin: 0 }}>{pedido.cliente_telefone}</p>
      )}
      {linhas.map((l) => (
        <p key={l} style={{ margin: 0 }}>
          {l}
        </p>
      ))}

      <h2 style={{ fontSize: "13pt", margin: "16px 0 4px" }}>Itens</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {pedido.itens.map((i) => (
            <tr key={i.id}>
              <td style={{ padding: "3px 0", verticalAlign: "top" }}>
                {i.quantidade}× {i.nome_produto}
                {(i.cor_selecionada || i.tamanho_selecionado) && (
                  <span>
                    {" "}
                    (
                    {[i.cor_selecionada, i.tamanho_selecionado]
                      .filter(Boolean)
                      .join(" / ")}
                    )
                  </span>
                )}
              </td>
              <td style={{ padding: "3px 0", textAlign: "right" }}>
                {brl(i.subtotal)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ paddingTop: 10 }}>Subtotal</td>
            <td style={{ paddingTop: 10, textAlign: "right" }}>
              {brl(subtotal)}
            </td>
          </tr>
          {pedido.frete > 0 && (
            <tr>
              <td>Frete</td>
              <td style={{ textAlign: "right" }}>{brl(pedido.frete)}</td>
            </tr>
          )}
          <tr>
            <td style={{ fontWeight: 700, paddingTop: 6 }}>Total</td>
            <td style={{ fontWeight: 700, paddingTop: 6, textAlign: "right" }}>
              {brl(pedido.total)}
            </td>
          </tr>
          {pedido.valor_reembolsado > 0 && (
            <tr>
              <td>Devolvido</td>
              <td style={{ textAlign: "right" }}>
                − {brl(pedido.valor_reembolsado)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pedido.codigo_rastreio && (
        <p style={{ marginTop: 16 }}>
          <strong>Rastreio:</strong> {pedido.codigo_rastreio}
        </p>
      )}
    </div>
  );
}

/* ------------------------- detalhe do pedido ------------------------- */

type Painel = "devolucao" | "rastreio" | "observacoes" | null;

function Detalhe({
  pedidoInicial,
  onFechar,
  onMudou,
}: {
  pedidoInicial: Pedido;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [pedido, setPedido] = useState<Pedido>(pedidoInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel>(null);

  const [valorDevolucao, setValorDevolucao] = useState("");
  const [motivoDevolucao, setMotivoDevolucao] = useState(
    MOTIVOS_DEVOLUCAO[0].valor,
  );
  const [confirmaDevolucao, setConfirmaDevolucao] = useState(false);

  const [rastreioManual, setRastreioManual] = useState(
    pedidoInicial.codigo_rastreio ?? "",
  );
  const [eventos, setEventos] = useState<any[] | null>(null);

  const [observacoes, setObservacoes] = useState(
    pedidoInicial.observacoes_internas ?? "",
  );

  const corpoRef = useRef<HTMLDivElement>(null);

  const proximos = PROXIMOS_STATUS[pedido.status] ?? [];
  const subtotal = pedido.total - pedido.frete;
  const devolvivel = pedido.total - pedido.valor_reembolsado;
  const podeDevolver =
    devolvivel > 0 &&
    pedido.status !== "pendente" &&
    pedido.status !== "cancelado";

  /* Trava a rolagem do fundo e fecha no Esc. Sem isso o conteúdo de
     trás rola junto no celular — era metade da sensação de "bugado". */
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

  const recarregar = useCallback(async () => {
    try {
      const atual = await buscarPedido(pedido.id);
      if (atual) {
        setPedido(atual);
        setRastreioManual(atual.codigo_rastreio ?? "");
        setObservacoes(atual.observacoes_internas ?? "");
      }
    } catch {
      /* a tela continua com o que já tem */
    }
    onMudou();
  }, [pedido.id, onMudou]);

  function limpar() {
    setErro(null);
    setAviso(null);
  }

  async function executar(chave: string, acao: () => Promise<void>) {
    setOcupado(chave);
    limpar();
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
      corpoRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setOcupado(null);
    }
  }

  const mudarStatus = (novo: StatusPedido) =>
    executar(`status-${novo}`, async () => {
      await atualizarStatusPedido(pedido.id, novo, pedido.status);
      await recarregar();
      setAviso(`Pedido marcado como ${ROTULO_STATUS[novo].toLowerCase()}.`);
    });

  const criarEtiqueta = () =>
    executar("etiqueta", async () => {
      const r = await gerarEtiqueta(pedido.id);
      await recarregar();
      if (r.etiquetaUrl) {
        window.open(r.etiquetaUrl, "_blank", "noopener,noreferrer");
        setAviso("Etiqueta gerada. O PDF abriu em outra aba.");
      } else {
        setAviso(
          r.jaExiste
            ? "Este envio já estava registrado."
            : "Envio registrado. O PDF aparece aqui em instantes.",
        );
      }
    });

  const rastrear = () =>
    executar("rastrear", async () => {
      const r = await rastrearPedidoAdmin(pedido.id);
      if (r.semEnvio) {
        setAviso(r.mensagem ?? "Este pedido ainda não foi postado.");
        setEventos([]);
        return;
      }
      setEventos(Array.isArray(r.eventos) ? r.eventos : []);
      setPainel("rastreio");
      await recarregar();
    });

  const guardarRastreio = () =>
    executar("rastreio-manual", async () => {
      await salvarCodigoRastreio(pedido.id, rastreioManual);
      await recarregar();
      setAviso("Código de rastreio salvo.");
    });

  const guardarObservacoes = () =>
    executar("observacoes", async () => {
      await salvarObservacoes(pedido.id, observacoes);
      await recarregar();
      setAviso("Anotação salva.");
      setPainel(null);
    });

  const devolver = () =>
    executar("devolucao", async () => {
      const bruto = valorDevolucao.trim().replace(/\./g, "").replace(",", ".");
      const valor = bruto === "" ? undefined : Number(bruto);

      if (valor != null && (!Number.isFinite(valor) || valor <= 0)) {
        throw new Error(
          "Digite um valor válido ou deixe em branco para devolver tudo.",
        );
      }

      const r = await reembolsarPedido(pedido.id, valor, motivoDevolucao);
      await recarregar();
      setPainel(null);
      setConfirmaDevolucao(false);
      setValorDevolucao("");
      setAviso(
        r.totalDevolvido
          ? `${brl(r.valorDevolvido)} devolvidos. O pedido está devolvido por inteiro.`
          : `${brl(r.valorDevolvido)} devolvidos ao cliente.`,
      );
    });

  async function copiarEndereco() {
    const texto = [
      pedido.cliente_nome ?? "",
      pedido.cliente_telefone ?? "",
      ...enderecoEmLinhas(pedido),
    ]
      .filter(Boolean)
      .join("\n");

    limpar();
    setAviso(
      (await copiar(texto))
        ? "Endereço copiado."
        : "Não consegui copiar — selecione o texto à mão.",
    );
  }

  const linkWhatsapp = pedido.cliente_telefone
    ? `https://wa.me/55${apenasDigitos(pedido.cliente_telefone)}?text=${encodeURIComponent(
        `Olá${pedido.cliente_nome ? `, ${pedido.cliente_nome.split(" ")[0]}` : ""}! ` +
          `Sobre o seu pedido #${pedido.numero}: `,
      )}`
    : null;

  const temEtiqueta = Boolean(pedido.etiqueta_url);

  return (
    <>
      <div className="folha-fundo nao-imprimir">
        <button
          aria-label="Fechar"
          onClick={onFechar}
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px] sem-toque-minimo"
        />

        <div className="folha anim-surgir" role="dialog" aria-modal="true">
          {/* ---------------- cabeçalho ---------------- */}
          <div className="folha-topo px-4 py-3 border-b border-[#e7e7ea] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-[#0f1117]">
                  Pedido #{pedido.numero}
                </h2>
                <Etiqueta status={pedido.status} />
              </div>
              <p className="text-[12px] text-[#9ca3af] mt-0.5">
                {dataHora(pedido.created_at)}
              </p>
            </div>
            <button
              onClick={onFechar}
              aria-label="Fechar"
              className="toque w-10 h-10 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0"
            >
              <X size={18} className="text-[#374151]" />
            </button>
          </div>

          {/* ---------------- corpo ---------------- */}
          <div ref={corpoRef} className="folha-corpo px-4 py-4 space-y-3">
            {erro && (
              <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5 flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="text-[#b91c1c] shrink-0 mt-0.5"
                />
                <p className="text-[12.5px] text-[#b91c1c] break-words">
                  {erro}
                </p>
              </div>
            )}
            {aviso && (
              <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2.5 flex items-start gap-2">
                <Check size={15} className="text-[#15803d] shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[#15803d] break-words">
                  {aviso}
                </p>
              </div>
            )}

            {/* Cliente */}
            <Secao titulo="Cliente">
              <p className="text-[14px] text-[#0f1117]">
                {pedido.cliente_nome ?? "Sem cadastro"}
              </p>
              {pedido.cliente_email && (
                <p className="text-[12.5px] text-[#6b7280] mt-0.5 break-all">
                  {pedido.cliente_email}
                </p>
              )}
              {pedido.cliente_telefone && (
                <p className="text-[12.5px] text-[#6b7280] mt-0.5">
                  {pedido.cliente_telefone}
                </p>
              )}
              {linkWhatsapp && (
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-app-claro mt-2.5 text-[#15803d] border-[#bbf7d0]"
                >
                  <MessageCircle size={15} />
                  Falar no WhatsApp
                </a>
              )}
            </Secao>

            {/* Entrega */}
            <Secao
              titulo="Entrega"
              acao={
                enderecoEmLinhas(pedido).length > 0 ? (
                  <button
                    onClick={copiarEndereco}
                    className="sem-toque-minimo inline-flex items-center gap-1 text-[12px] font-semibold text-[#374151]"
                  >
                    <Copy size={12} />
                    Copiar
                  </button>
                ) : undefined
              }
            >
              {enderecoEmLinhas(pedido).length > 0 ? (
                <div className="flex gap-1.5">
                  <MapPin
                    size={14}
                    className="text-[#9ca3af] shrink-0 mt-0.5"
                  />
                  <div className="text-[13px] text-[#374151] leading-snug">
                    {enderecoEmLinhas(pedido).map((l) => (
                      <p key={l}>{l}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#9ca3af]">
                  Sem endereço — retirada ou combinado direto.
                </p>
              )}

              {pedido.frete_transportadora && (
                <p className="text-[12.5px] text-[#6b7280] mt-2 flex items-center gap-1.5">
                  <Truck size={14} className="text-[#9ca3af]" />
                  {pedido.frete_transportadora}
                  {pedido.frete_prazo_dias != null &&
                    ` · até ${pedido.frete_prazo_dias} dias`}
                </p>
              )}

              {pedido.codigo_rastreio && (
                <p className="text-[12.5px] text-[#0f1117] mt-1.5 font-semibold">
                  Rastreio: {pedido.codigo_rastreio}
                </p>
              )}

              {/* Etiqueta de envio */}
              <div className="mt-3 space-y-2">
                {temEtiqueta ? (
                  <a
                    href={pedido.etiqueta_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-app"
                  >
                    <Printer size={15} />
                    Imprimir etiqueta
                  </a>
                ) : (
                  <button
                    onClick={criarEtiqueta}
                    disabled={ocupado !== null}
                    className="btn-app"
                  >
                    {ocupado === "etiqueta" ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Tag size={15} />
                    )}
                    Gerar etiqueta de envio
                  </button>
                )}

                <button
                  onClick={rastrear}
                  disabled={ocupado !== null}
                  className="btn-app-claro"
                >
                  {ocupado === "rastrear" ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Radar size={15} />
                  )}
                  Rastrear encomenda
                </button>

                <button
                  onClick={() =>
                    setPainel(painel === "rastreio" ? null : "rastreio")
                  }
                  className="sem-toque-minimo text-[12.5px] font-semibold text-[#6b7280] underline"
                >
                  Digitar código de rastreio à mão
                </button>
              </div>

              {painel === "rastreio" && (
                <div className="mt-2.5 space-y-2">
                  <input
                    value={rastreioManual}
                    onChange={(e) => setRastreioManual(e.target.value)}
                    placeholder="Ex.: AA123456789BR"
                    className="campo-app"
                  />
                  <button
                    onClick={guardarRastreio}
                    disabled={ocupado !== null}
                    className="btn-app-claro"
                  >
                    {ocupado === "rastreio-manual" ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    Salvar código
                  </button>

                  {eventos && eventos.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-[#f0f0f1]">
                      {eventos.slice(0, 8).map((ev: any, i: number) => (
                        <div key={i} className="flex gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0f1117] mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[12.5px] text-[#0f1117] leading-snug">
                              {ev.status ??
                                ev.description ??
                                ev.title ??
                                "Movimentação"}
                            </p>
                            {(ev.location || ev.city) && (
                              <p className="text-[11.5px] text-[#9ca3af]">
                                {ev.location ?? ev.city}
                              </p>
                            )}
                            {ev.created_at && (
                              <p className="text-[11.5px] text-[#9ca3af]">
                                {dataHora(ev.created_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {eventos && eventos.length === 0 && (
                    <p className="text-[12px] text-[#9ca3af]">
                      Ainda sem movimentação registrada.
                    </p>
                  )}
                </div>
              )}
            </Secao>

            {/* Itens */}
            <Secao titulo="Itens">
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
                {pedido.valor_reembolsado > 0 && (
                  <>
                    <div className="flex justify-between text-[12.5px] text-[#7e22ce]">
                      <span>Devolvido ao cliente</span>
                      <span className="tabular-nums">
                        − {brl(pedido.valor_reembolsado)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[12.5px] font-semibold text-[#374151]">
                      <span>Ficou com você</span>
                      <span className="tabular-nums">{brl(devolvivel)}</span>
                    </div>
                  </>
                )}
                {pedido.metodo_pagamento && (
                  <p className="text-[11.5px] text-[#9ca3af] pt-1">
                    Pago com{" "}
                    {ROTULO_PAGAMENTO[pedido.metodo_pagamento] ??
                      pedido.metodo_pagamento}
                  </p>
                )}
              </div>
            </Secao>

            {/* Anotações */}
            <Secao
              titulo="Minhas anotações"
              acao={
                painel === "observacoes" ? undefined : (
                  <button
                    onClick={() => setPainel("observacoes")}
                    className="sem-toque-minimo inline-flex items-center gap-1 text-[12px] font-semibold text-[#374151]"
                  >
                    <StickyNote size={12} />
                    {pedido.observacoes_internas ? "Editar" : "Escrever"}
                  </button>
                )
              }
            >
              {painel === "observacoes" ? (
                <div className="space-y-2">
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    maxLength={2000}
                    placeholder="Ex.: cliente pediu para entregar depois das 18h."
                    className="campo-app"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={guardarObservacoes}
                      disabled={ocupado !== null}
                      className="btn-app"
                    >
                      {ocupado === "observacoes" ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      Salvar
                    </button>
                    <button
                      onClick={() => {
                        setObservacoes(pedido.observacoes_internas ?? "");
                        setPainel(null);
                      }}
                      className="btn-app-claro"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#374151] whitespace-pre-wrap leading-snug">
                  {pedido.observacoes_internas || (
                    <span className="text-[#9ca3af]">
                      Nada anotado. Só você vê o que escrever aqui.
                    </span>
                  )}
                </p>
              )}
            </Secao>

            {/* Devolução */}
            {podeDevolver && (
              <Secao titulo="Devolver dinheiro">
                {painel === "devolucao" ? (
                  <div className="space-y-2.5">
                    <p className="text-[12.5px] text-[#6b7280] leading-snug">
                      Disponível para devolver:{" "}
                      <strong>{brl(devolvivel)}</strong>. O valor sai do saldo
                      da sua conta de recebimentos e cai na fatura do cliente em
                      alguns dias.
                    </p>

                    <div>
                      <label className="text-[12px] font-semibold text-[#374151]">
                        Valor (deixe em branco para devolver tudo)
                      </label>
                      <input
                        value={valorDevolucao}
                        onChange={(e) => {
                          setValorDevolucao(e.target.value);
                          setConfirmaDevolucao(false);
                        }}
                        inputMode="decimal"
                        placeholder={devolvivel.toFixed(2).replace(".", ",")}
                        className="campo-app mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-[12px] font-semibold text-[#374151]">
                        Motivo
                      </label>
                      <select
                        value={motivoDevolucao}
                        onChange={(e) => setMotivoDevolucao(e.target.value)}
                        className="campo-app mt-1"
                      >
                        {MOTIVOS_DEVOLUCAO.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {m.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>

                    {confirmaDevolucao ? (
                      <>
                        <p className="text-[12.5px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-xl px-3.5 py-2.5">
                          Devolver{" "}
                          <strong>
                            {valorDevolucao.trim() === ""
                              ? brl(devolvivel)
                              : valorDevolucao}
                          </strong>
                          ? Isso não tem volta.
                        </p>
                        <button
                          onClick={devolver}
                          disabled={ocupado !== null}
                          className="btn-app"
                          style={{ background: "#b91c1c" }}
                        >
                          {ocupado === "devolucao" ? (
                            <RefreshCw size={15} className="animate-spin" />
                          ) : (
                            <Undo2 size={15} />
                          )}
                          Confirmar devolução
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmaDevolucao(true)}
                        className="btn-app-claro text-[#b91c1c] border-[#fecaca]"
                      >
                        <Undo2 size={15} />
                        Continuar
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setPainel(null);
                        setConfirmaDevolucao(false);
                      }}
                      className="sem-toque-minimo text-[12.5px] font-semibold text-[#6b7280] underline"
                    >
                      Deixar para depois
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      limpar();
                      setPainel("devolucao");
                    }}
                    className="btn-app-claro text-[#b91c1c] border-[#fecaca]"
                  >
                    <Undo2 size={15} />
                    Devolver ao cliente
                  </button>
                )}
              </Secao>
            )}

            {/* Imprimir pedido */}
            <button onClick={() => window.print()} className="btn-app-claro">
              <Printer size={15} />
              Imprimir pedido
            </button>

            {pedido.reembolsado_em && (
              <p className="text-[11.5px] text-[#9ca3af] text-center">
                Última devolução em {dataHora(pedido.reembolsado_em)}
              </p>
            )}
          </div>

          {/* ---------------- rodapé fixo: o próximo passo ---------------- */}
          <div className="folha-rodape border-t border-[#e7e7ea] bg-white px-4 py-3 safe-bottom">
            {proximos.length > 0 ? (
              <div className="flex gap-2">
                {proximos.map((s) => (
                  <button
                    key={s}
                    onClick={() => mudarStatus(s)}
                    disabled={ocupado !== null}
                    className={
                      s === "cancelado"
                        ? "btn-app-claro text-[#b91c1c] border-[#fecaca]"
                        : "btn-app"
                    }
                  >
                    {ocupado === `status-${s}` ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {ROTULO_STATUS[s]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-[#9ca3af] text-center py-1.5">
                Pedido {ROTULO_STATUS[pedido.status].toLowerCase()} — nada a
                fazer aqui.
              </p>
            )}
          </div>
        </div>
      </div>

      <Comprovante pedido={pedido} />
    </>
  );
}

/* ------------------------------ lista ------------------------------ */

export default function Orders() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState(TODOS);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await listarPedidos());
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar os pedidos.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      const porAba = aba === TODOS || p.status === aba;
      if (!porAba) return false;
      if (!termo) return true;

      return (
        p.numero.toLowerCase().includes(termo) ||
        (p.cliente_nome ?? "").toLowerCase().includes(termo) ||
        (p.cliente_telefone ?? "").includes(termo) ||
        (p.codigo_rastreio ?? "").toLowerCase().includes(termo) ||
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

  /* O detalhe lê do array vivo: depois de recarregar, a folha aberta
     mostra o estado novo sem precisar fechar e abrir de novo. */
  const aberto = useMemo(
    () => pedidos.find((p) => p.id === abertoId) ?? null,
    [pedidos, abertoId],
  );

  return (
    <>
      <div className="p-4 sm:p-6 max-w-[1100px] mx-auto space-y-3.5 nao-imprimir">
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
              placeholder="Número, cliente, produto ou rastreio"
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
                className="sem-toque-minimo text-[12px] font-semibold text-[#991b1b] underline mt-1"
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
                  onClick={() => setAbertoId(p.id)}
                  className="cartao-app cartao-toque w-full p-3.5 text-left flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-[#0f1117]">
                        #{p.numero}
                      </span>
                      <Etiqueta status={p.status} />
                      {p.etiqueta_url && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#6b7280]">
                          <Tag size={11} />
                          etiqueta
                        </span>
                      )}
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
                    {p.valor_reembolsado > 0 && (
                      <p className="text-[11px] text-[#7e22ce]">
                        − {brl(p.valor_reembolsado)}
                      </p>
                    )}
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
      </div>

      {aberto && (
        <Detalhe
          key={aberto.id}
          pedidoInicial={aberto}
          onFechar={() => setAbertoId(null)}
          onMudou={carregar}
        />
      )}
    </>
  );
}

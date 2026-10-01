import { useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  CreditCard,
  QrCode,
  Truck,
  Store as StoreIcon,
  Package,
  MapPin,
  CalendarClock,
  ReceiptText,
} from "lucide-react";
import { useStore } from "../context/StoreContext";
import { lerUltimoPedido } from "../lib/pedidoLocal";

/**
 * Tela final do checkout.
 *
 * ----------------------------------------------------------------
 * O que ela precisa responder, em ordem
 * ----------------------------------------------------------------
 * Quem acabou de pagar tem três perguntas, sempre as mesmas:
 * deu certo? · o que eu comprei? · quando chega?
 *
 * A ordem dos blocos segue isso, e não o desenho: estado do
 * pagamento primeiro, previsão de entrega e endereço depois, valores
 * por último. É a ordem que as plataformas grandes usam, por um
 * motivo prático — em celular só o primeiro terço da tela é visto
 * sem rolar, e o que a pessoa procura ali é "deu certo".
 *
 * ----------------------------------------------------------------
 * De onde vêm os dados
 * ----------------------------------------------------------------
 * Do aparelho da própria pessoa (ver pedidoLocal.ts). Não existe
 * consulta de pedido por número no servidor, e não deve existir: os
 * números são sequenciais, então uma busca aberta entregaria os
 * pedidos e endereços de todos os clientes da loja a quem contasse
 * de 1 em 1.
 *
 * Se o resumo não estiver lá — aba anônima, armazenamento bloqueado,
 * link aberto em outro aparelho — a tela mostra a versão simples,
 * com o número e para onde ir. Nunca fica em branco.
 *
 * ----------------------------------------------------------------
 * O que esta tela NÃO diz
 * ----------------------------------------------------------------
 * Que enviamos e-mail de confirmação. Nada no sistema envia esse
 * e-mail hoje, e mandar a pessoa esperar na caixa de entrada por uma
 * mensagem que não vem é pior do que não prometer nada.
 */

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

/**
 * Data de entrega a partir do prazo em dias ÚTEIS.
 *
 * Por que data e não "3 a 7 dias úteis": prazo em dias obriga a
 * pessoa a abrir o calendário e contar, e é a dúvida que mais gera
 * contato com a loja ("onde está meu pedido?"). Uma data ela lê e
 * guarda.
 *
 * Feriado não entra na conta — por isso a tela escreve "previsão", e
 * escreve também o prazo em dias, que é o número que a
 * transportadora de fato prometeu.
 */
function dataAposDiasUteis(dias: number) {
  const d = new Date();
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const diaSemana = d.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1;
  }
  return d;
}

function formatarDataLonga(d: Date) {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatarDataHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NOME_METODO: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  cartao: "Cartão",
};

function Cartao({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-black/5 ${className}`}
    >
      {children}
    </div>
  );
}

function TituloBloco({
  icone,
  children,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
      <span className="text-[#9ca3af] shrink-0">{icone}</span>
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
        {children}
      </h2>
    </div>
  );
}

export default function StoreOrderConfirmed() {
  const { store } = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const numero = params.get("numero");
  const metodoUrl = params.get("metodo");
  /**
   * Dois caminhos trazem o status, e os dois precisam valer:
   * "status" é o nosso, posto pelo checkout; "redirect_status" é o da
   * Stripe, acrescentado por ela ao return_url quando o pagamento
   * passa por redirecionamento (3-D Secure, e o Pix em teste).
   */
  const status = params.get("status") ?? params.get("redirect_status");

  /**
   * Lê uma vez só. Sem isto, cada render bate no localStorage e faz
   * JSON.parse de novo — e o resumo não muda enquanto a tela está
   * aberta.
   */
  const pedido = useMemo(
    () => (store ? lerUltimoPedido(store.id, numero) : null),
    [store, numero],
  );

  if (!store) return null;

  // O método salvo vale mais que o da URL: a URL pode ter sido
  // editada à mão, o resumo veio de quem fechou o pedido.
  const metodo = pedido?.metodo || metodoUrl || "";

  /**
   * Cartão chega como "credito" ou "debito" — nunca como "cartao".
   *
   * Esta linha já testou `metodo === "cartao"`, valor que o checkout
   * não produz. O efeito era exatamente o contrário do que a tela se
   * propõe: quem pagava no cartão caía no texto do WhatsApp e lia
   * que a loja ia "combinar pagamento e entrega" — depois de já ter
   * pagado.
   */
  const foiOnline =
    metodo === "pix" ||
    metodo === "credito" ||
    metodo === "debito" ||
    metodo === "cartao";

  const pago = status === "succeeded";
  const processando = status === "processing";
  const ehPix = metodo === "pix";

  const visual = pago
    ? {
        icone: <CheckCircle2 size={30} className="text-white" strokeWidth={2} />,
        titulo: "Pagamento aprovado!",
        texto:
          "Recebemos o seu pagamento. O pedido já está na fila da loja para ser preparado.",
        etiqueta: "Pago",
        corEtiqueta: "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]",
      }
    : foiOnline
      ? {
          icone: <Clock size={28} className="text-white" strokeWidth={2} />,
          titulo: "Pedido recebido!",
          texto: ehPix
            ? "Estamos confirmando o seu Pix. Assim que o banco avisar, a loja começa a preparar o pedido — costuma levar poucos minutos."
            : processando
              ? "O seu pagamento está sendo processado. Assim que for confirmado, a loja começa a preparar o pedido."
              : "Estamos confirmando o seu pagamento. Se algo der errado, a loja entra em contato pelo telefone que você informou.",
          etiqueta: "Confirmando pagamento",
          corEtiqueta: "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
        }
      : {
          icone: (
            <MessageCircle size={28} className="text-white" strokeWidth={2} />
          ),
          titulo: "Pedido recebido!",
          texto:
            "A loja já recebeu os detalhes do seu pedido e vai falar com você para combinar pagamento e entrega.",
          etiqueta: "Aguardando a loja",
          corEtiqueta: "bg-[#f4f4f5] border-[#e4e4e7] text-[#3f3f46]",
        };

  const dataHora = pedido?.criadoEm ? formatarDataHora(pedido.criadoEm) : null;

  const prazo = pedido?.fretePrazoDias ?? null;
  const previsao =
    pedido?.entrega === "entrega" && prazo && prazo > 0
      ? formatarDataLonga(dataAposDiasUteis(prazo))
      : null;

  const whatsappLoja = store.whatsapp ? onlyDigits(store.whatsapp) : "";

  return (
    <div
      className="min-h-dvh pb-10"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--store-primary) 10%, #fafafa 90%) 0px, #fafafa 260px)",
      }}
    >
      <div className="mx-auto w-full max-w-[520px] px-4 pt-8 space-y-3">
        {/* ------------------------------------------------------
            1. Deu certo?
            ------------------------------------------------------ */}
        <div className="text-center pb-2">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {visual.icone}
          </div>

          <h1 className="text-[20px] font-bold text-[#111827] leading-tight">
            {visual.titulo}
          </h1>

          <p className="mt-2 text-[13px] text-[#6b7280] leading-snug max-w-[340px] mx-auto">
            {visual.texto}
          </p>
        </div>

        {/* ------------------------------------------------------
            2. Qual é o meu pedido
            ------------------------------------------------------ */}
        <Cartao className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-[#9ca3af] font-semibold">
                Pedido
              </p>
              <p className="text-[17px] font-extrabold text-[#111827] tabular-nums">
                #{numero ?? pedido?.numero ?? "—"}
              </p>
              {dataHora && (
                <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                  {dataHora}
                </p>
              )}
            </div>

            <span
              className={`shrink-0 text-[11px] font-semibold rounded-full border px-2.5 py-1 ${visual.corEtiqueta}`}
            >
              {visual.etiqueta}
            </span>
          </div>
        </Cartao>

        {/* ------------------------------------------------------
            3. Quando chega, e onde
            ------------------------------------------------------ */}
        {pedido && (
          <Cartao>
            <TituloBloco
              icone={
                pedido.entrega === "retirada" ? (
                  <StoreIcon size={14} />
                ) : (
                  <Truck size={14} />
                )
              }
            >
              {pedido.entrega === "retirada" ? "Retirada" : "Entrega"}
            </TituloBloco>

            <div className="px-4 pb-4 space-y-3">
              {previsao && (
                <div className="flex items-start gap-2.5 rounded-xl bg-[#fafafa] border border-[#f0f0f1] px-3 py-2.5">
                  <CalendarClock
                    size={16}
                    className="shrink-0 mt-0.5"
                    style={{ color: "var(--store-primary)" }}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111827] leading-snug">
                      Previsão: até {previsao}
                    </p>
                    {/* O prazo em dias fica escrito porque é o número
                        que a transportadora prometeu — a data é a
                        nossa conta em cima dele, e feriado não entra. */}
                    <p className="text-[11.5px] text-[#6b7280] mt-0.5 leading-snug">
                      {prazo} {prazo === 1 ? "dia útil" : "dias úteis"} depois
                      que a loja postar o pedido
                    </p>
                  </div>
                </div>
              )}

              {pedido.entrega === "retirada" ? (
                <div className="flex items-start gap-2.5">
                  <StoreIcon size={15} className="text-[#9ca3af] shrink-0 mt-0.5" />
                  <p className="text-[13px] text-[#374151] leading-snug">
                    Você vai retirar na loja. Ela combina com você o melhor
                    horário.
                  </p>
                </div>
              ) : (
                pedido.endereco && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-[#9ca3af] shrink-0 mt-0.5" />
                    <div className="min-w-0 text-[13px] text-[#374151] leading-snug">
                      <p>
                        {pedido.endereco.logradouro}
                        {pedido.endereco.numero
                          ? `, ${pedido.endereco.numero}`
                          : ""}
                        {pedido.endereco.complemento
                          ? ` — ${pedido.endereco.complemento}`
                          : ""}
                      </p>
                      <p className="text-[#6b7280]">
                        {[
                          pedido.endereco.bairro,
                          pedido.endereco.cidade &&
                            `${pedido.endereco.cidade}${
                              pedido.endereco.uf ? `/${pedido.endereco.uf}` : ""
                            }`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {pedido.endereco.cep && (
                        <p className="text-[#9ca3af] text-[12px]">
                          CEP {pedido.endereco.cep}
                        </p>
                      )}
                    </div>
                  </div>
                )
              )}

              {pedido.entrega === "entrega" &&
                (pedido.freteACombinar ? (
                  <p className="text-[12.5px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-3 py-2 leading-snug">
                    O frete ainda não está fechado. A loja calcula e combina o
                    valor com você antes de enviar.
                  </p>
                ) : (
                  (pedido.freteTransportadora || pedido.freteNome) && (
                    <p className="text-[12px] text-[#9ca3af]">
                      {[pedido.freteTransportadora, pedido.freteNome]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )
                ))}
            </div>
          </Cartao>
        )}

        {/* ------------------------------------------------------
            4. O que eu comprei, e quanto ficou
            ------------------------------------------------------ */}
        {pedido && pedido.itens.length > 0 && (
          <Cartao>
            <TituloBloco icone={<Package size={14} />}>
              {pedido.itens.length === 1
                ? "1 item"
                : `${pedido.itens.length} itens`}
            </TituloBloco>

            <div className="px-4 divide-y divide-[#f4f4f5]">
              {pedido.itens.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  {item.imagemUrl ? (
                    <img
                      src={item.imagemUrl}
                      alt=""
                      className="w-11 h-11 rounded-lg object-cover bg-[#f4f4f5] shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-[#f4f4f5] shrink-0 flex items-center justify-center">
                      <Package size={16} className="text-[#d4d4d8]" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[#111827] leading-snug line-clamp-2">
                      {item.nome}
                    </p>
                    <p className="text-[11.5px] text-[#9ca3af] mt-0.5">
                      {item.quantidade}x
                      {item.variacao ? ` · ${item.variacao}` : ""}
                    </p>
                  </div>

                  <span className="text-[13px] font-semibold text-[#111827] tabular-nums shrink-0">
                    {formatBRL(item.preco * item.quantidade)}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 mt-1 border-t border-[#f0f0f1] space-y-1.5">
              <div className="flex items-center justify-between text-[12.5px] text-[#6b7280]">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatBRL(pedido.subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[12.5px] text-[#6b7280]">
                <span>
                  {pedido.entrega === "retirada" ? "Retirada na loja" : "Frete"}
                </span>
                <span className="tabular-nums">
                  {pedido.freteACombinar && pedido.entrega === "entrega"
                    ? "a combinar"
                    : pedido.frete === 0
                      ? "Grátis"
                      : formatBRL(pedido.frete)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-[#f4f4f5]">
                <span className="text-[13px] font-semibold text-[#111827]">
                  Total
                </span>
                <span className="text-[17px] font-extrabold text-[#111827] tabular-nums">
                  {formatBRL(pedido.total)}
                </span>
              </div>

              {foiOnline && (
                <div className="flex items-center gap-2 pt-2 text-[12px] text-[#6b7280]">
                  {ehPix ? (
                    <QrCode size={14} className="shrink-0 text-[#9ca3af]" />
                  ) : (
                    <CreditCard size={14} className="shrink-0 text-[#9ca3af]" />
                  )}
                  <span>{NOME_METODO[metodo] ?? "Pagamento online"}</span>
                </div>
              )}
            </div>
          </Cartao>
        )}

        {/* ------------------------------------------------------
            5. Como acompanhar, e como falar com a loja
            ------------------------------------------------------ */}
        <Cartao>
          <TituloBloco icone={<ReceiptText size={14} />}>
            Acompanhar
          </TituloBloco>

          <div className="px-4 pb-4">
            <p className="text-[12.5px] text-[#6b7280] leading-snug">
              Guarde o número <strong className="text-[#374151]">
                #{numero ?? pedido?.numero ?? ""}
              </strong>
              . Em “Meus pedidos” você vê o status e o código de rastreio
              quando a loja postar — é só informar o mesmo CPF e telefone da
              compra.
            </p>

            <Link
              to={`/loja/${store.slug}/meus-pedidos`}
              className="mt-3 h-12 min-h-[48px] w-full rounded-xl border border-[#e4e4e7] bg-white flex items-center justify-center text-[13px] font-semibold text-[#111827]"
            >
              Ver meus pedidos
            </Link>

            {whatsappLoja && (
              <a
                href={`https://wa.me/55${whatsappLoja}?text=${encodeURIComponent(
                  `Olá! Tenho uma dúvida sobre o pedido #${numero ?? pedido?.numero ?? ""}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 h-12 min-h-[48px] w-full rounded-xl border border-[#e4e4e7] bg-white flex items-center justify-center gap-2 text-[13px] font-semibold text-[#111827]"
              >
                <MessageCircle size={15} className="text-[#9ca3af]" />
                Falar com a loja
              </a>
            )}
          </div>
        </Cartao>

        {/* ------------------------------------------------------
            6. Voltar a comprar
            ------------------------------------------------------ */}
        <button
          onClick={() => navigate(`/loja/${store.slug}`)}
          className="w-full h-13 min-h-[52px] rounded-2xl text-white text-[14px] font-semibold"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          Continuar comprando
        </button>
      </div>
    </div>
  );
}

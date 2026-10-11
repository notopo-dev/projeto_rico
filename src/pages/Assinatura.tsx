import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Clock, Loader2 } from "lucide-react";
import CartaoAssinatura from "../components/CartaoAssinatura";
import { lerAssinatura, type EstadoAssinatura } from "../lib/assinaturaApi";
import { TelaCarregando } from "../components/Carregando";

/**
 * Mensalidade da loja.
 *
 * ----------------------------------------------------------------
 * Esta tela substitui um cartão que não funcionava
 * ----------------------------------------------------------------
 * O painel tinha um bloco "Plano atual" em Loja que lia
 * `store.plano` e `store.plano_renovacao` — duas colunas que NÃO
 * existem no banco. Ele mostrava "Gratuito / Sem renovação
 * agendada" para todo mundo, para sempre, com um botão
 * "Gerenciar plano" que não ia a lugar nenhum.
 *
 * ----------------------------------------------------------------
 * A tela desenha; quem decide é o banco
 * ----------------------------------------------------------------
 * `podeUsar` vem da função `loja_pode_operar`. Esta tela não refaz
 * a conta — e mesmo que alguém forjasse a resposta no navegador, o
 * gatilho em `orders` continuaria recusando pedido de loja sem
 * assinatura.
 */

const BENEFICIOS = [
  "Loja com endereço próprio",
  "Produtos e grade de cor e tamanho sem limite",
  "Cartão e Pix, direto na sua conta",
  "Frete e etiqueta no painel",
  "Pedidos, clientes e relatórios",
  "E-mail automático de pedido",
];

function Caixa({
  tom,
  icone,
  titulo,
  children,
}: {
  tom: "bom" | "aviso" | "ruim";
  icone: React.ReactNode;
  titulo: string;
  children?: React.ReactNode;
}) {
  const cores = {
    bom: { fundo: "#f0fdf4", borda: "#bbf7d0", texto: "#166534" },
    aviso: { fundo: "#fffbeb", borda: "#fde68a", texto: "#92400e" },
    ruim: { fundo: "#fef2f2", borda: "#fecaca", texto: "#b91c1c" },
  }[tom];

  return (
    <div
      className="rounded-lg border px-4 py-3 flex gap-3"
      style={{ background: cores.fundo, borderColor: cores.borda }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: cores.texto }}>
        {icone}
      </span>
      <div className="min-w-0">
        <p className="t-corpo-forte" style={{ color: cores.texto }}>
          {titulo}
        </p>
        {children && (
          <div className="t-apoio mt-0.5" style={{ color: cores.texto }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function dataBr(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function Assinatura() {
  const [estado, setEstado] = useState<EstadoAssinatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recemAssinou, setRecemAssinou] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setEstado(await lerAssinatura());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler a assinatura.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (erro) {
    return (
      <div className="p-4 sm:p-6 max-w-[640px] mx-auto">
        <Caixa tom="ruim" icone={<AlertTriangle size={18} />} titulo="Não deu para carregar">
          {erro}
        </Caixa>
      </div>
    );
  }

  if (!estado) return <TelaCarregando />;

  // Cortesia: loja interna ou demonstração. Não vê cobrança nenhuma.
  if (estado.isenta) {
    return (
      <div className="p-4 sm:p-6 max-w-[640px] mx-auto space-y-4">
        <h1 className="t-titulo font-bold text-[#0f1117]">Assinatura</h1>
        <Caixa tom="bom" icone={<CheckCircle2 size={18} />} titulo="Loja sem cobrança">
          Esta loja está liberada permanentemente. Nada é cobrado.
        </Caixa>
      </div>
    );
  }

  const assinou = estado.situacao === "ativa" || recemAssinou;
  const emTeste = estado.situacao === "teste" && (estado.horasDeTeste ?? 0) > 0;
  const bloqueada = !estado.podeUsar;

  return (
    <div className="p-4 sm:p-6 max-w-[640px] mx-auto space-y-4">
      <div className="px-1">
        <h1 className="t-titulo font-bold text-[#0f1117]">Assinatura</h1>
        <p className="t-corpo text-[#6b7280] mt-1 leading-snug">
          Um plano só, valor fixo. A gente não cobra porcentagem das suas
          vendas — venda dez mil no mês e continua sendo R$ 78,00.
        </p>
      </div>

      {/* ---- situação ---- */}
      {assinou && (
        <Caixa tom="bom" icone={<CheckCircle2 size={18} />} titulo="Assinatura ativa">
          {estado.proximaCobranca
            ? `Próxima cobrança em ${dataBr(estado.proximaCobranca)}.`
            : "Tudo certo com o seu plano."}
        </Caixa>
      )}

      {!assinou && emTeste && (
        <Caixa
          tom="aviso"
          icone={<Clock size={18} />}
          titulo={
            estado.horasDeTeste === 1
              ? "Falta 1 hora de teste"
              : `Faltam ${estado.horasDeTeste} horas de teste`
          }
        >
          Quando o teste acabar, a loja sai do ar até você assinar. Nada é
          apagado — volta tudo assim que a assinatura entrar.
        </Caixa>
      )}

      {!assinou && bloqueada && (
        <Caixa
          tom="ruim"
          icone={<AlertTriangle size={18} />}
          titulo={
            estado.situacao === "cancelada"
              ? "Assinatura cancelada"
              : "O teste acabou"
          }
        >
          Sua loja está fora do ar e não recebe pedidos novos. Seus produtos,
          pedidos e clientes continuam guardados.
        </Caixa>
      )}

      {estado.situacao === "inadimplente" && (
        <Caixa
          tom="aviso"
          icone={<AlertTriangle size={18} />}
          titulo="A última cobrança não passou"
        >
          Sua loja continua no ar. Vamos tentar o cartão de novo nos próximos
          dias — se quiser, cadastre outro agora.
        </Caixa>
      )}

      {/* ---- plano ---- */}
      {!assinou && (
        <div className="cartao-app p-4 sm:p-5">
          <div className="flex items-baseline gap-1.5">
            <span className="t-corpo text-[#6b7280]">R$</span>
            <span className="t-numero text-[#0f1117] text-[40px] leading-none">
              78
            </span>
            <span className="t-corpo text-[#6b7280]">/mês</span>
          </div>

          <ul className="mt-4 space-y-2">
            {BENEFICIOS.map((b) => (
              <li key={b} className="t-apoio text-[#374151] flex gap-2">
                <CheckCircle2 size={15} className="text-[#16a34a] mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {emTeste && (
            <p className="t-micro text-[#6b7280] mt-4 leading-snug">
              Assinando agora, a primeira cobrança só acontece quando o seu
              teste terminar. Você não paga pelo tempo que ainda falta.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-[#e7e7ea]">
            <CartaoAssinatura
              rotulo="Assinar por R$ 78"
              onPronto={() => {
                setRecemAssinou(true);
                carregar();
              }}
            />
          </div>
        </div>
      )}

      {assinou && (
        <div className="cartao-app p-4 sm:p-5">
          <h2 className="t-secao text-[#0f1117]">O que está incluído</h2>
          <ul className="mt-3 space-y-2">
            {BENEFICIOS.map((b) => (
              <li key={b} className="t-apoio text-[#374151] flex gap-2">
                <CheckCircle2 size={15} className="text-[#16a34a] mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="t-micro text-[#6b7280] mt-4 leading-snug">
            Para cancelar ou trocar o cartão, fale com a gente pelo e-mail de
            suporte. A taxa da operadora do cartão das suas vendas é cobrada
            por ela, não por nós.
          </p>
        </div>
      )}
    </div>
  );
}

/** Usado pelo App quando a loja está bloqueada: sem menu, sem saída. */
export function AssinaturaBloqueio() {
  return (
    <div className="min-h-[100dvh] bg-[#f6f7f9] py-6">
      <Assinatura />
    </div>
  );
}

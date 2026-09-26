import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pencil,
  Building2,
  User,
  Landmark,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  consultarStatusStripe,
  type StatusCompletoStripe,
} from "../lib/stripeCustomApi";
import StripeCustomOnboarding from "./StripeCustomOnboarding";
import StripeEmbeddedOnboarding from "./StripeEmbeddedOnboarding";
import PreparoVerificacao from "./PreparoVerificacao";
import FormasPagamento from "./FormasPagamento";
import {
  PainelGerenciarConta,
  PainelNotificacoes,
} from "./StripeConnectPaineis";

/**
 * Traduz os códigos de requisito da Stripe para algo que o
 * lojista entenda. Se o código não estiver mapeado, mostra o
 * próprio código (melhor que "campo não identificado").
 */
function traduzirRequisito(campo: string | null): string {
  if (!campo) return "Informação pendente";

  const mapa: Record<string, string> = {
    "configuration.merchant.mcc": "Categoria do negócio",
    "configuration.merchant.support_phone": "Telefone de suporte ao cliente",
    "configuration.merchant.support.phone": "Telefone de suporte ao cliente",
    "configuration.merchant.support.email": "E-mail de suporte ao cliente",
    "configuration.merchant.support.address": "Endereço de suporte",
    "defaults.profile.business_url": "Endereço (URL) da loja",
    "defaults.profile.product_description": "Descrição do que a loja vende",
    "identity.attestations.terms_of_service.account.date":
      "Aceite dos termos de uso",
    "identity.attestations.terms_of_service.account.ip":
      "Aceite dos termos de uso",
    "identity.business_details.monthly_estimated_revenue.amount":
      "Faturamento mensal estimado",
    "identity.business_details.monthly_estimated_revenue.currency":
      "Moeda do faturamento estimado",
    "identity.individual.verification.proof_of_liveness":
      "Verificação de identidade (selfie/prova de vida)",
    "individual.id_numbers": "CPF do titular",
    "individual.date_of_birth": "Data de nascimento",
    "individual.address": "Endereço do titular",
    "individual.given_name": "Nome do titular",
    "individual.surname": "Sobrenome do titular",
    "individual.email": "E-mail do titular",
    "individual.phone": "Telefone do titular",
    "individual.documents.primary_verification":
      "Documento de identidade (RG ou CNH)",
    "business_details.id_numbers": "CNPJ da empresa",
    "business_details.registered_name": "Razão social",
    "business_details.registered_address": "Endereço da empresa",
    "business_details.phone": "Telefone da empresa",
    "configuration.recipient.default_outbound_destination":
      "Conta bancária para recebimento",
    external_account: "Conta bancária para recebimento",
    tos_acceptance: "Aceite dos termos de uso",
  };

  // Tenta achar correspondência exata ou por prefixo
  if (mapa[campo]) return mapa[campo];
  for (const [chave, valor] of Object.entries(mapa)) {
    if (campo.includes(chave)) return valor;
  }

  return campo;
}

/**
 * Painel de status da conta de recebimento do lojista.
 *
 * Fluxo em duas etapas, depois da migração para Accounts v2:
 *   1. Conta ainda não existe  -> formulário nosso (StripeCustomOnboarding),
 *      que coleta os dados básicos e cria a conta na Stripe.
 *   2. Conta criada, faltando verificação -> formulário EMBUTIDO da
 *      Stripe (StripeEmbeddedOnboarding), que roda dentro da nossa
 *      página e é o único capaz de coletar selfie e aceite de termos.
 */
export default function StripeStatusPanel() {
  const [status, setStatus] = useState<StatusCompletoStripe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [verificacaoAberta, setVerificacaoAberta] = useState(false);
  // Mostra a tela de preparo antes de abrir o formulário de identidade.
  const [preparoVisto, setPreparoVisto] = useState(false);
  // Acabou de enviar a verificação nesta visita — muda a mensagem de topo.
  const [enviadoAgora, setEnviadoAgora] = useState(false);
  // Sanfonado dos dados da conta.
  const [dadosAbertos, setDadosAbertos] = useState(false);

  const temporizadores = useRef<number[]>([]);

  function pararAcompanhamento() {
    temporizadores.current.forEach((id) => window.clearTimeout(id));
    temporizadores.current = [];
  }

  /**
   * Recarrega o status.
   *
   * @param silencioso  não troca a tela pelo "Verificando..." — usado
   * pelas reconsultas automáticas. Sem isto, cada reconsulta
   * desmontava o formulário da Stripe no meio do caminho.
   */
  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    setErro(null);
    try {
      const data = await consultarStatusStripe();
      setStatus(data);
      // Deu certo: não há mais o que esperar.
      if (data?.situacao === "ativo") pararAcompanhamento();
    } catch (err) {
      if (!silencioso) {
        setErro(
          err instanceof Error ? err.message : "Erro ao consultar status.",
        );
      }
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }

  /**
   * A Stripe processa o cadastro em segundo plano e leva de alguns
   * segundos a alguns minutos. Em vez de pedir para o lojista ficar
   * apertando "Atualizar", reconsultamos sozinhos por um tempo — em
   * silêncio, sem piscar a tela.
   */
  function acompanharAnalise() {
    pararAcompanhamento();
    [3000, 8000, 15000, 25000, 40000, 60000, 90000].forEach((ms) => {
      temporizadores.current.push(window.setTimeout(() => carregar(true), ms));
    });
  }

  useEffect(() => {
    carregar();
    return pararAcompanhamento;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só na primeira vez. Depois de já ter status na tela, uma reconsulta
  // acontece por baixo — trocar tudo por um spinner remontava o
  // formulário da Stripe e devolvia o lojista ao começo.
  if (carregando && !status) {
    return (
      <div className="bg-white border border-[#e4e4e7] rounded-[6px] px-4 py-8">
        <div className="flex items-center justify-center gap-2 text-[13px] text-[#6b7280]">
          <Loader2 size={16} className="animate-spin" />
          Verificando sua conta de recebimento...
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-white border border-[#e4e4e7] rounded-[6px] px-4 py-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-[12px] text-[#b91c1c]">
          <span>{erro}</span>
          <button
            onClick={carregar}
            className="shrink-0 font-semibold underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const contaExiste = Boolean(status?.accountId);

  // ETAPA 1 — conta ainda não existe: formulário nosso, que a cria.
  if (
    !status ||
    status.situacao === "nao_iniciado" ||
    (modoEdicao && !contaExiste)
  ) {
    return (
      <div>
        {modoEdicao && (
          <button
            onClick={() => {
              setModoEdicao(false);
              carregar();
            }}
            className="mb-2 text-[12px] text-[#6b7280] underline"
          >
            ← Voltar para o resumo
          </button>
        )}
        <StripeCustomOnboarding />
      </div>
    );
  }

  // ETAPA 2 — conta existe e o lojista pediu para editar/continuar:
  // quem conduz é a Stripe, dentro da nossa página.
  if ((modoEdicao || verificacaoAberta) && !preparoVisto) {
    return (
      <div>
        <button
          onClick={() => {
            setModoEdicao(false);
            setVerificacaoAberta(false);
          }}
          className="mb-2 text-[12px] text-[#6b7280] underline"
        >
          ← Voltar
        </button>
        <PreparoVerificacao
          quantidadePendencias={status.requisitos?.length}
          onComecar={() => setPreparoVisto(true)}
        />
      </div>
    );
  }

  if (modoEdicao || verificacaoAberta) {
    return (
      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0f1117]">
              Verificação da conta
            </h2>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              Confirmação de identidade, aqui mesmo no painel.
            </p>
          </div>
          <button
            onClick={() => {
              setModoEdicao(false);
              setVerificacaoAberta(false);
              setPreparoVisto(false);
              carregar(true);
            }}
            className="shrink-0 text-[12px] text-[#6b7280] underline"
          >
            Voltar
          </button>
        </div>
        <div className="px-4 py-4">
          <StripeEmbeddedOnboarding
            onConcluido={() => {
              // A Stripe avisa aqui tanto quando o lojista CONCLUI
              // quanto quando ele SAI do formulário. Nos dois casos o
              // certo é fechar e voltar ao resumo.
              //
              // Antes não fechava: o painel reconsultava o status, o
              // spinner substituía a tela inteira, o formulário era
              // remontado do zero e reaparecia no mesmo passo — o
              // lojista confirmava, e caía no botão de confirmar de
              // novo, sem fim.
              setVerificacaoAberta(false);
              setModoEdicao(false);
              setPreparoVisto(false);
              setEnviadoAgora(true);
              carregar(true);
              acompanharAnalise();
            }}
          />
        </div>
      </div>
    );
  }

  const dados = status.dados;
  const ehEmpresa = status.tipoPessoa === "company";
  const temPendencias = Boolean(
    status.requisitos && status.requisitos.length > 0,
  );

  const situacaoVisual = {
    ativo: {
      icone: <CheckCircle2 size={18} className="text-[#16a34a] shrink-0" />,
      cor: "border-[#bbf7d0] bg-[#f0fdf4]",
      titulo: "text-[#15803d]",
      texto: "text-[#166534]",
      tituloTexto: "Conta ativa e pronta para receber",
      descricao: "Pagamentos com cartão já estão disponíveis na sua loja.",
    },
    em_analise: {
      icone: <Clock size={18} className="text-[#b45309] shrink-0" />,
      cor: "border-[#fde68a] bg-[#fffbeb]",
      titulo: "text-[#b45309]",
      texto: "text-[#92400e]",
      tituloTexto: "Cadastro em análise",
      descricao:
        "Estamos verificando seus dados. Isso costuma levar de alguns minutos a 2 dias úteis.",
    },
    pendencias: {
      icone: <AlertTriangle size={18} className="text-[#b45309] shrink-0" />,
      cor: "border-[#fde68a] bg-[#fffbeb]",
      titulo: "text-[#b45309]",
      texto: "text-[#92400e]",
      tituloTexto: "Faltam informações",
      descricao: "Complete os dados abaixo para liberar os recebimentos.",
    },
    incompleto: {
      icone: <AlertTriangle size={18} className="text-[#6b7280] shrink-0" />,
      cor: "border-[#e4e4e7] bg-[#fafafa]",
      titulo: "text-[#374151]",
      texto: "text-[#6b7280]",
      tituloTexto: "Cadastro incompleto",
      descricao: "Continue de onde parou para começar a receber pagamentos.",
    },
  }[status.situacao] ?? {
    icone: <AlertTriangle size={18} className="text-[#6b7280] shrink-0" />,
    cor: "border-[#e4e4e7] bg-[#fafafa]",
    titulo: "text-[#374151]",
    texto: "text-[#6b7280]",
    tituloTexto: "Status desconhecido",
    descricao: "",
  };

  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
      <div className="px-4 py-3 border-b border-[#e4e4e7] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            Conta de recebimento
          </h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            Onde os pagamentos da sua loja são depositados.
          </p>
        </div>
        <button
          onClick={carregar}
          className="shrink-0 flex items-center gap-1 text-[11px] text-[#6b7280] hover:text-[#374151]"
          title="Atualizar status"
        >
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Acabou de enviar: explica que agora é só esperar, para o
            lojista não achar que precisa preencher tudo outra vez. */}
        {enviadoAgora && status.situacao !== "ativo" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3">
            <CheckCircle2 size={18} className="text-[#16a34a] shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[#15803d]">
                Recebemos seus dados
              </p>
              <p className="text-[11px] text-[#166534] leading-snug">
                Não precisa preencher de novo. Esta tela se atualiza sozinha
                assim que a análise terminar — pode sair e voltar depois.
              </p>
            </div>
          </div>
        )}

        {/* Avisos da própria Stripe (pendências, risco, conformidade).
            Este componente é exigido quando a Stripe responde pelos
            saldos negativos — e a página precisa estar em site-links. */}
        <PainelNotificacoes />

        {/* Situação atual */}
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${situacaoVisual.cor}`}
        >
          {situacaoVisual.icone}
          <div>
            <p className={`text-[13px] font-medium ${situacaoVisual.titulo}`}>
              {situacaoVisual.tituloTexto}
            </p>
            <p className={`text-[11px] ${situacaoVisual.texto}`}>
              {situacaoVisual.descricao}
            </p>
          </div>
        </div>

        {/* Pendências específicas + atalho para a verificação da Stripe */}
        {temPendencias && (
          <div className="rounded-xl border border-[#e4e4e7] px-3.5 py-3">
            <p className="text-[12px] font-semibold text-[#374151] mb-2">
              Informações pendentes
            </p>
            <ul className="space-y-1">
              {/* Campos diferentes da Stripe podem virar o mesmo texto para
                  o lojista (por exemplo data e IP do aceite de termos).
                  Mostramos uma linha só — repetir confunde. */}
              {Array.from(
                new Set(
                  status.requisitos!.map((r) => traduzirRequisito(r.campo)),
                ),
              ).map((texto) => (
                <li
                  key={texto}
                  className="text-[11px] text-[#6b7280] flex items-start gap-1.5"
                >
                  <span className="text-[#b45309] mt-0.5">•</span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setVerificacaoAberta(true)}
              className="mt-3 w-full h-11 rounded-xl bg-[#0f1117] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"
            >
              <ShieldCheck size={15} />
              Concluir verificação
            </button>
            <p className="mt-2 text-[10.5px] text-[#9ca3af] leading-snug">
              A confirmação de identidade é feita aqui mesmo, em ambiente
              criptografado. Seus documentos não ficam armazenados no painel.
            </p>
          </div>
        )}

        {/* Resumo dos dados cadastrados */}
        <div className="rounded-xl border border-[#e4e4e7] divide-y divide-[#f0f0f1]">
          {/* Titular */}
          <div className="px-3.5 py-3 flex items-start gap-3">
            {ehEmpresa ? (
              <Building2 size={16} className="text-[#9ca3af] shrink-0 mt-0.5" />
            ) : (
              <User size={16} className="text-[#9ca3af] shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
                {ehEmpresa ? "Empresa" : "Titular"}
              </p>
              {ehEmpresa && dados?.empresa ? (
                <>
                  <p className="text-[13px] text-[#111827] mt-0.5">
                    {dados.empresa.razao_social ?? "—"}
                  </p>
                  {dados.empresa.telefone && (
                    <p className="text-[11px] text-[#6b7280]">
                      {dados.empresa.telefone}
                    </p>
                  )}
                </>
              ) : dados?.individual ? (
                <>
                  <p className="text-[13px] text-[#111827] mt-0.5">
                    {[dados.individual.nome, dados.individual.sobrenome]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                  {dados.individual.email && (
                    <p className="text-[11px] text-[#6b7280]">
                      {dados.individual.email}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-[#9ca3af] mt-0.5">
                  Não informado
                </p>
              )}
            </div>
          </div>

          {/* Conta bancária */}
          <div className="px-3.5 py-3 flex items-start gap-3">
            <Landmark size={16} className="text-[#9ca3af] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#9ca3af] uppercase tracking-wide font-semibold">
                Conta bancária
              </p>
              {dados?.conta_bancaria ? (
                <>
                  <p className="text-[13px] text-[#111827] mt-0.5">
                    {dados.conta_bancaria.banco_nome ?? "Banco"} ••••{" "}
                    {dados.conta_bancaria.ultimos_digitos ?? "----"}
                  </p>
                  {dados.conta_bancaria.titular && (
                    <p className="text-[11px] text-[#6b7280]">
                      {dados.conta_bancaria.titular}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-[#9ca3af] mt-0.5">
                  Não cadastrada
                </p>
              )}
            </div>
          </div>
        </div>

        {/* O lojista edita os próprios dados aqui dentro. Exigido pela
            Stripe junto com o banner acima. */}
        {/* O que a loja oferece no checkout. Fica aqui, e não em
            Configurações, porque depende do que a Stripe liberou
            para esta conta — a informação está nesta mesma tela. */}
        <FormasPagamento status={status} aoSalvar={() => carregar(true)} />

        {/* Sanfonado controlado, e não <details>.
            Os componentes embutidos da Stripe medem a própria altura
            no momento em que montam. Dentro de um <details> fechado
            eles montavam escondidos, com altura zero, e continuavam
            em branco depois de abrir — era o "não aparece nada".
            Agora só montam quando a seção abre de fato. */}
        <div className="rounded-xl border border-[#e4e4e7]">
          <button
            onClick={() => setDadosAbertos((v) => !v)}
            aria-expanded={dadosAbertos}
            className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left text-[13px] font-medium text-[#374151]"
          >
            Dados da conta de recebimento
            <ChevronDown
              size={16}
              className={`shrink-0 text-[#9ca3af] transition-transform ${
                dadosAbertos ? "rotate-180" : ""
              }`}
            />
          </button>
          {dadosAbertos && (
            <div className="border-t border-[#f0f0f1] px-3.5 pb-3 pt-3">
              <PainelGerenciarConta />
            </div>
          )}
        </div>

        {/* Ação */}
        <button
          onClick={() => setModoEdicao(true)}
          className="w-full h-11 rounded-xl border border-[#e4e4e7] bg-white text-[13px] font-medium text-[#374151] hover:bg-[#f4f4f5] flex items-center justify-center gap-1.5"
        >
          <Pencil size={14} />
          {status.situacao === "ativo" || status.situacao === "em_analise"
            ? "Alterar dados da conta"
            : "Continuar cadastro"}
        </button>
      </div>
    </div>
  );
}

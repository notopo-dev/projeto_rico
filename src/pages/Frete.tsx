import { useCallback, useEffect, useState } from "react";
import {
  Truck,
  Store as StoreIcon,
  Handshake,
  Gift,
  MapPin,
  Package,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Check,
  Plug,
  Link2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  concluirConexao,
  desconectarMelhorEnvio,
  getConfigFrete,
  iniciarConexao,
  salvarRegrasFrete,
  testarMelhorEnvio,
  trocarAmbiente,
  type ConfigFrete,
  type FreteModo,
  type MelhorEnvioAmbiente,
  type TesteMelhorEnvio,
} from "../lib/freteConfigApi";
import { TelaCarregando } from "../components/Carregando";

/**
 * Frete da loja.
 *
 * Antes o frete só existia por Melhor Envio, e quem não tinha conta lá
 * caía sempre em "frete a combinar" — a loja não conseguia cobrar
 * entrega de jeito nenhum. Agora são três modos, e os dois primeiros
 * funcionam sem depender de ninguém.
 *
 * O botão "Testar conexão" existe porque antes o único jeito de
 * descobrir que o token estava errado era um CLIENTE travar no
 * checkout. O lojista nunca ficava sabendo.
 */

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "12,50" e "12.50" viram 12.5; vazio vira null. */
function paraNumero(v: string): number | null {
  const limpo = v.replace(/\s/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function paraCampo(v: number | null) {
  return v === null ? "" : String(v).replace(".", ",");
}

const MODOS: {
  id: FreteModo;
  titulo: string;
  descricao: string;
  icone: typeof Truck;
}[] = [
  {
    id: "fixo",
    titulo: "Valor fixo",
    descricao:
      "Um preço só para qualquer endereço. É o mais simples e já funciona hoje.",
    icone: Package,
  },
  {
    id: "melhor_envio",
    titulo: "Tabela das transportadoras",
    descricao:
      "Correios, Jadlog e outras, calculado pelo CEP e pelo peso. Precisa de conta no Melhor Envio.",
    icone: Truck,
  },
  {
    id: "combinar",
    titulo: "Combinar depois",
    descricao:
      "O pedido fecha sem frete e você acerta a entrega com o cliente.",
    icone: Handshake,
  },
];

/* --------------------------- peças --------------------------- */

function Cartao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cartao-app overflow-hidden">
      <div className="px-3.5 pt-3.5 pb-2">
        <p className="text-[13px] font-bold text-[#0f1117]">{titulo}</p>
        {descricao && (
          <p className="text-[11.5px] text-[#6b7280] leading-snug mt-0.5">
            {descricao}
          </p>
        )}
      </div>
      <div className="px-3.5 pb-3.5">{children}</div>
    </div>
  );
}

function Interruptor({
  ligado,
  onAlternar,
  rotulo,
}: {
  ligado: boolean;
  onAlternar: (v: boolean) => void;
  rotulo: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => onAlternar(!ligado)}
      className={`sem-toque-minimo relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        ligado ? "bg-[#16a34a]" : "bg-[#d4d4d8]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
          ligado ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Campo({
  rotulo,
  dica,
  ...props
}: {
  rotulo: string;
  dica?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-[#6b7280] mb-1">
        {rotulo}
      </label>
      <input {...props} className="campo-app" />
      {dica && (
        <p className="mt-1 text-[11px] text-[#9ca3af] leading-snug">{dica}</p>
      )}
    </div>
  );
}

/* --------------------------- tela --------------------------- */

export default function Frete() {
  const [config, setConfig] = useState<ConfigFrete | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  /* regras */
  const [modo, setModo] = useState<FreteModo>("combinar");
  const [valorFixo, setValorFixo] = useState("");
  const [prazoFixo, setPrazoFixo] = useState("");
  const [nomeFixo, setNomeFixo] = useState("");
  const [gratisLigado, setGratisLigado] = useState(false);
  const [gratisAcima, setGratisAcima] = useState("");
  const [retirada, setRetirada] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  /* melhor envio */
  const [ambiente, setAmbiente] = useState<MelhorEnvioAmbiente>("sandbox");
  const [ocupadoME, setOcupadoME] = useState(false);
  const [testando, setTestando] = useState(false);
  const [teste, setTeste] = useState<TesteMelhorEnvio | null>(null);
  const [erroME, setErroME] = useState<string | null>(null);
  const [recemConectado, setRecemConectado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const c = await getConfigFrete();
      setConfig(c);
      setModo(c.frete_modo);
      setValorFixo(paraCampo(c.frete_fixo));
      setPrazoFixo(c.frete_fixo_prazo_dias?.toString() ?? "");
      setNomeFixo(c.frete_fixo_nome ?? "");
      setGratisLigado(c.frete_gratis_acima !== null);
      setGratisAcima(paraCampo(c.frete_gratis_acima));
      setRetirada(c.retirada_na_loja);
      setInstrucoes(c.retirada_instrucoes ?? "");
      setAmbiente(c.melhor_envio_ambiente);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível carregar o frete.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Volta da tela de autorização do Melhor Envio.
   *
   * Eles devolvem o lojista para cá com ?code= e ?state= na URL. O
   * código vale uma vez só e por pouco tempo, então é trocado por
   * token imediatamente — e a URL é limpa logo depois, para um F5 não
   * tentar usar de novo um código já gasto e mostrar erro à toa.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const recusado = params.get("error");

    if (!code && !recusado) return;

    window.history.replaceState({}, "", "/frete");

    if (recusado || !code || !state) {
      setErroME(
        "A autorização no Melhor Envio não foi concluída. Clique em Conectar para tentar de novo.",
      );
      return;
    }

    let vivo = true;
    setOcupadoME(true);
    (async () => {
      try {
        const { conta } = await concluirConexao(code, state);
        if (!vivo) return;
        setRecemConectado(conta ?? "Conta conectada");
        await carregar();
        setTestando(true);
        setTeste(await testarMelhorEnvio());
      } catch (e) {
        if (vivo) {
          setErroME(
            e instanceof Error ? e.message : "Não foi possível concluir a conexão.",
          );
        }
      } finally {
        if (vivo) {
          setOcupadoME(false);
          setTestando(false);
        }
      }
    })();

    return () => {
      vivo = false;
    };
    // Só na entrada da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await salvarRegrasFrete({
        frete_modo: modo,
        frete_fixo: paraNumero(valorFixo),
        frete_fixo_prazo_dias: prazoFixo ? Number(prazoFixo) : null,
        frete_fixo_nome: nomeFixo,
        frete_gratis_acima: gratisLigado ? paraNumero(gratisAcima) : null,
        retirada_na_loja: retirada,
        retirada_instrucoes: instrucoes,
      });
      setSalvo(true);
      await carregar();
      window.setTimeout(() => setSalvo(false), 2500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Manda o lojista autorizar no Melhor Envio. */
  async function conectar() {
    setOcupadoME(true);
    setErroME(null);
    setTeste(null);
    try {
      window.location.href = await iniciarConexao();
    } catch (e) {
      setErroME(
        e instanceof Error ? e.message : "Não foi possível iniciar a conexão.",
      );
      setOcupadoME(false);
    }
  }

  async function mudarAmbiente(novo: MelhorEnvioAmbiente) {
    if (novo === ambiente) return;

    // Trocar de ambiente derruba a autorização: ela vale só no
    // ambiente em que foi dada. Melhor avisar do que a pessoa achar
    // que continua conectada.
    if (
      config?.conectado &&
      !window.confirm(
        "Trocar de ambiente desconecta a conta do Melhor Envio. Você vai precisar conectar de novo. Continuar?",
      )
    ) {
      return;
    }

    setOcupadoME(true);
    setErroME(null);
    setTeste(null);
    setRecemConectado(null);
    try {
      await trocarAmbiente(novo);
      setAmbiente(novo);
      await carregar();
    } catch (e) {
      setErroME(e instanceof Error ? e.message : "Não foi possível trocar.");
    } finally {
      setOcupadoME(false);
    }
  }

  async function testar() {
    setTestando(true);
    setErroME(null);
    try {
      setTeste(await testarMelhorEnvio());
    } catch (e) {
      setErroME(e instanceof Error ? e.message : "Não foi possível testar.");
    } finally {
      setTestando(false);
    }
  }

  async function desconectar() {
    setOcupadoME(true);
    setErroME(null);
    setTeste(null);
    setRecemConectado(null);
    try {
      await desconectarMelhorEnvio();
      await carregar();
    } catch (e) {
      setErroME(
        e instanceof Error ? e.message : "Não foi possível desconectar.",
      );
    } finally {
      setOcupadoME(false);
    }
  }

  if (carregando) return <TelaCarregando texto="Carregando o frete…" />;

  const semMedidas = config?.produtos_sem_medidas ?? [];
  const precisaMelhorEnvio = modo === "melhor_envio";
  const bloqueiaME =
    precisaMelhorEnvio && (!config?.conectado || !config?.cep_origem);

  return (
    <div className="p-4 sm:p-6 max-w-[760px] mx-auto space-y-3.5 pb-28">
      {erro && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-[#b91c1c] shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-[#b91c1c] break-words">{erro}</p>
        </div>
      )}

      {/* ---------------- modo ---------------- */}
      <Cartao
        titulo="Como você cobra o frete"
        descricao="Vale para todos os pedidos da loja. Dá para mudar quando quiser."
      >
        <div className="space-y-2">
          {MODOS.map((m) => {
            const Icone = m.icone;
            const ativo = modo === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setModo(m.id)}
                aria-pressed={ativo}
                className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                  ativo
                    ? "border-[#0f1117] bg-[#fafafa]"
                    : "border-[#e7e7ea] bg-white"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 ${ativo ? "text-[#0f1117]" : "text-[#9ca3af]"}`}
                >
                  <Icone size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#0f1117]">
                    {m.titulo}
                  </span>
                  <span className="block text-[11.5px] text-[#6b7280] leading-snug mt-0.5">
                    {m.descricao}
                  </span>
                </span>
                <span
                  className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2 flex items-center justify-center ${
                    ativo ? "border-[#0f1117]" : "border-[#d4d4d8]"
                  }`}
                >
                  {ativo && (
                    <span className="h-2 w-2 rounded-full bg-[#0f1117]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {modo === "fixo" && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo
              rotulo="Valor do frete"
              value={valorFixo}
              onChange={(e) => setValorFixo(e.target.value)}
              inputMode="decimal"
              placeholder="15,00"
              dica="Cobrado em qualquer endereço."
            />
            <Campo
              rotulo="Prazo de entrega (dias úteis)"
              value={prazoFixo}
              onChange={(e) =>
                setPrazoFixo(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              inputMode="numeric"
              placeholder="5"
              dica="Opcional. Aparece para o cliente no checkout."
            />
            <div className="sm:col-span-2">
              <Campo
                rotulo="Nome que o cliente vê"
                value={nomeFixo}
                onChange={(e) => setNomeFixo(e.target.value)}
                placeholder="Entrega"
                dica='Opcional. Em branco, aparece como "Entrega".'
              />
            </div>
          </div>
        )}

        {modo === "combinar" && (
          <div className="mt-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 flex items-start gap-2.5">
            <AlertTriangle
              size={14}
              className="text-[#b45309] shrink-0 mt-0.5"
            />
            <p className="text-[11.5px] text-[#92400e] leading-snug">
              O pedido fecha só com o valor dos produtos. Você combina a
              entrega depois, e o que o cliente pagou não inclui o frete.
            </p>
          </div>
        )}
      </Cartao>

      {/* ---------------- frete grátis ---------------- */}
      <Cartao titulo="Frete grátis">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-[#6b7280]">
            <Gift size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[#374151] leading-snug">
              A partir de um valor de compra, o frete sai de graça.
            </p>
          </div>
          <Interruptor
            ligado={gratisLigado}
            onAlternar={setGratisLigado}
            rotulo="Frete grátis"
          />
        </div>

        {gratisLigado && (
          <div className="mt-3">
            <Campo
              rotulo="A partir de"
              value={gratisAcima}
              onChange={(e) => setGratisAcima(e.target.value)}
              inputMode="decimal"
              placeholder="199,00"
              dica="Conta o valor dos produtos, sem o frete. Quando bate, é a única opção que aparece."
            />
          </div>
        )}
      </Cartao>

      {/* ---------------- retirada ---------------- */}
      <Cartao titulo="Retirar na loja">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-[#6b7280]">
            <StoreIcon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[#374151] leading-snug">
              O cliente busca pessoalmente. Sem frete e sem pedir endereço
              de entrega.
            </p>
          </div>
          <Interruptor
            ligado={retirada}
            onAlternar={setRetirada}
            rotulo="Retirar na loja"
          />
        </div>

        {retirada && (
          <div className="mt-3">
            <label className="block text-[11.5px] font-medium text-[#6b7280] mb-1">
              Onde e quando retirar
            </label>
            <textarea
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              rows={3}
              placeholder="Rua X, 123 — Centro. De segunda a sexta, das 8h às 18h."
              className="campo-app h-auto py-2.5 resize-y"
            />
            <p className="mt-1 text-[11px] text-[#9ca3af] leading-snug">
              Aparece para o cliente assim que ele escolher retirar.
            </p>
          </div>
        )}
      </Cartao>

      {/* ---------------- pendências ---------------- */}
      {(bloqueiaME || (precisaMelhorEnvio && semMedidas.length > 0)) && (
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3 space-y-2.5">
          <p className="text-[12.5px] font-semibold text-[#92400e]">
            Falta isto para a tabela das transportadoras funcionar
          </p>

          {!config?.cep_origem && (
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-[#b45309] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#92400e] leading-snug">
                <strong>CEP de origem.</strong> Sem saber de onde sai a
                encomenda não dá para calcular nada. Preencha em
                Configurações → Loja → Endereço de origem.
              </p>
            </div>
          )}

          {!config?.conectado && (
            <div className="flex items-start gap-2">
              <Plug size={14} className="text-[#b45309] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#92400e] leading-snug">
                <strong>Conta do Melhor Envio conectada.</strong> Logo abaixo.
              </p>
            </div>
          )}

          {semMedidas.length > 0 && (
            <div className="flex items-start gap-2">
              <Package size={14} className="text-[#b45309] shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-[#92400e] leading-snug">
                <strong>
                  {semMedidas.length}{" "}
                  {semMedidas.length === 1 ? "produto" : "produtos"} sem peso
                  ou medidas.
                </strong>{" "}
                A transportadora recusa o carrinho inteiro por causa de um
                só, e quem vê o erro é o cliente, no meio da compra:{" "}
                {semMedidas
                  .slice(0, 6)
                  .map((p) => p.nome)
                  .join(", ")}
                {semMedidas.length > 6 && ` e mais ${semMedidas.length - 6}`}.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- melhor envio ---------------- */}
      <Cartao
        titulo="Melhor Envio"
        descricao="Usado para cotar a tabela das transportadoras e para imprimir a etiqueta de envio."
      >
        {config?.conectado ? (
          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 flex items-start gap-2.5">
            <CheckCircle2 size={15} className="text-[#15803d] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#15803d]">
                Conectado
                {recemConectado || config.conta
                  ? ` como ${recemConectado ?? config.conta}`
                  : ""}
              </p>
              <p className="text-[11.5px] text-[#166534] leading-snug mt-0.5">
                Ambiente{" "}
                {config.melhor_envio_ambiente === "producao"
                  ? "Produção"
                  : "Teste"}
                . A autorização se renova sozinha — você não precisa fazer
                nada.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e7e7ea] bg-[#fafafa] px-3 py-2.5">
            <p className="text-[12px] text-[#374151] leading-snug">
              Conecte sua conta para cotar a tabela das transportadoras e
              imprimir etiqueta. Você vai para uma tela do Melhor Envio,
              autoriza, e volta para cá.
            </p>
            <p className="text-[11.5px] text-[#9ca3af] leading-snug mt-1.5">
              Não existe mais token para copiar e colar: o Melhor Envio
              passou a usar só este tipo de autorização.
            </p>
          </div>
        )}

        {/* ambiente */}
        <div className="mt-3">
          <p className="text-[11.5px] font-medium text-[#6b7280] mb-1.5">
            Ambiente
          </p>
          <div className="flex gap-2">
            {(
              [
                ["sandbox", "Teste"],
                ["producao", "Produção"],
              ] as [MelhorEnvioAmbiente, string][]
            ).map(([id, rotulo]) => (
              <button
                key={id}
                onClick={() => mudarAmbiente(id)}
                disabled={ocupadoME}
                aria-pressed={ambiente === id}
                className={`btn-app-pequeno flex-1 border disabled:opacity-50 ${
                  ambiente === id
                    ? "bg-[#0f1117] text-white border-[#0f1117]"
                    : "bg-white text-[#374151] border-[#e7e7ea]"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-[#9ca3af] leading-snug">
            Teste usa a conta de sandbox, com saldo fictício. Trocar de
            ambiente desconecta, porque a autorização vale só onde foi dada.
          </p>
        </div>

        {erroME && (
          <div className="mt-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5">
            <p className="text-[12px] text-[#b91c1c] leading-snug">{erroME}</p>
          </div>
        )}

        {teste && (
          <div
            className={`mt-2.5 rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${
              teste.conectado
                ? "border-[#bbf7d0] bg-[#f0fdf4]"
                : "border-[#fecaca] bg-[#fef2f2]"
            }`}
          >
            {teste.conectado ? (
              <CheckCircle2
                size={15}
                className="text-[#15803d] shrink-0 mt-0.5"
              />
            ) : (
              <AlertTriangle
                size={15}
                className="text-[#b91c1c] shrink-0 mt-0.5"
              />
            )}
            <div className="min-w-0">
              {teste.conectado ? (
                <>
                  <p className="text-[12px] font-semibold text-[#15803d]">
                    Tudo certo com {teste.nome}
                  </p>
                  <p className="text-[11.5px] text-[#166534] leading-snug mt-0.5">
                    {teste.saldo !== null && teste.saldo !== undefined
                      ? `Saldo de ${brl(teste.saldo)}. `
                      : ""}
                    {teste.saldo === 0
                      ? "Sem saldo não dá para imprimir etiqueta — cotar frete na loja funciona do mesmo jeito."
                      : "Já dá para cotar frete e imprimir etiqueta."}
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-[#b91c1c] leading-snug">
                  {teste.mensagem}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {config?.conectado ? (
            <>
              <button
                onClick={testar}
                disabled={testando || ocupadoME}
                className="btn-app disabled:opacity-50"
              >
                {testando ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Testar conexão
              </button>
              <button
                onClick={desconectar}
                disabled={ocupadoME}
                className="btn-app-claro text-[#b91c1c] border-[#fecaca] disabled:opacity-50"
              >
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={conectar}
              disabled={ocupadoME}
              className="btn-app disabled:opacity-50"
            >
              {ocupadoME ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Link2 size={15} />
              )}
              Conectar com o Melhor Envio
            </button>
          )}
        </div>
      </Cartao>

      {/* ---------------- salvar ---------------- */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10">
        <button
          onClick={salvar}
          disabled={salvando}
          className="btn-app w-full shadow-lg disabled:opacity-60"
        >
          {salvando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : salvo ? (
            <Check size={16} />
          ) : null}
          {salvo ? "Salvo" : "Salvar regras de frete"}
        </button>
      </div>
    </div>
  );
}

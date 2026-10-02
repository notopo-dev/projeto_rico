import { useState, useEffect } from "react";
import {
  Globe,
  Eye,
  Save,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import {
  getMyStore,
  updateMyStore,
  toFormData,
  type LojaFormData,
} from "../lib/lojaApi";

import type { Store } from "../types/database";
import EnderecoOrigemSection from "../components/EnderecoOrigemSection";
import DominioProprio from "../components/DominioProprio";
import Interruptor from "../components/Interruptor";

/**
 * Campo de texto da tela de Lojas.
 *
 * Mora AQUI, no nível do módulo, e não dentro de `Loja` — e essa é a
 * única coisa que de fato importa neste componente.
 *
 * Declarado lá dentro, ele virava uma função NOVA a cada render. O
 * React compara tipos de componente por identidade: tipo novo não é
 * atualizado, é desmontado e montado de novo. Na prática, a cada
 * tecla o <input> era destruído e recriado; o novo nascia sem foco, e
 * a tecla seguinte caía fora do campo. O efeito para quem usa era
 * exatamente "não dá para digitar".
 *
 * O valor entra por `value` e a mudança sai por `onChange`, em vez de
 * o componente alcançar o estado da tela por fora. É isso que permite
 * ele viver aqui, estável, sem precisar enxergar `form`.
 */
function Campo({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  rows = 0,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  const cls =
    "t-corpo w-full px-3 py-1.5 border border-[#e4e4e7] rounded-[6px] bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]";

  return (
    <div>
      <label className="t-corpo block font-medium text-[#374151] mb-1">
        {label}
      </label>

      {rows > 0 ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          /* O espaço antes de resize-none faltava: as duas classes
             saíam grudadas, o que estragava a última classe de foco e
             nunca aplicava o resize-none. */
          className={cls + " resize-none"}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </div>
  );
}

/** Mesma história do Campo: nível de módulo, valor e ação por fora. */
function Chave({
  label,
  description,
  ligado,
  onAlternar,
}: {
  label: string;
  description: string;
  ligado: boolean;
  onAlternar: (novo: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#f4f4f5] last:border-0">
      <div className="min-w-0">
        <p className="t-corpo font-medium text-[#0f1117]">{label}</p>
        <p className="t-corpo text-[#6b7280]">{description}</p>
      </div>

      <Interruptor ligado={ligado} onAlternar={onAlternar} rotulo={label} />
    </div>
  );
}

export default function Loja() {
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [store, setStore] =
    useState<Store | null>(null);

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<LojaFormData>({
      nome: "",
      slug: "",
      descricao: "",
      whatsapp: "",
      email: "",
      politica_troca: "",
      politica_frete: "",
      ativo: true,
      manter_estoque: true,
      exibir_sem_estoque: false,
      cep_origem: "",
      endereco_logradouro: "",
      endereco_numero: "",
      endereco_complemento: "",
      endereco_bairro: "",
      endereco_cidade: "",
      endereco_uf: "",
    });

  async function load() {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getMyStore();

      setStore(data);
      setForm(toFormData(data));
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar dados da loja."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    setSaveError(null);

    if (!form.nome.trim()) {
      setSaveError(
        "O nome da loja é obrigatório."
      );
      return;
    }

    if (!form.slug.trim()) {
      setSaveError(
        "O endereço da loja (slug) é obrigatório."
      );
      return;
    }

    setSaving(true);

    try {
      const updated =
        await updateMyStore(form);

      setStore(updated);

      /*
       * Avisa o topo do painel que a loja mudou.
       *
       * O Header e a Sidebar JÁ escutavam "loja-updated" — mas
       * ninguém no projeto disparava esse evento. Dois ouvintes
       * esperando um aviso que nunca vinha: por isso renomear a loja
       * não mudava nada no topo até recarregar a página.
       *
       * Disparar daqui é o que faltava para aqueles dois efeitos
       * deixarem de ser código morto.
       */
      window.dispatchEvent(
        new CustomEvent("loja-updated", {
          detail: {
            nome: updated.nome,
            slug: updated.slug,
            logoUrl: updated.logo_url ?? null,
          },
        }),
      );

      setSaved(true);

      setTimeout(
        () => setSaved(false),
        2500
      );
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar loja."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-[860px]">
        <div className="t-corpo flex items-center gap-2 text-[#6b7280]">
          <Loader2
            size={16}
            className="animate-spin"
          />

          Carregando dados da loja...
        </div>
      </div>
    );
  }

  if (loadError || !store) {
    return (
      <div className="p-4 sm:p-6 max-w-[860px]">
        <div className="t-corpo flex items-center justify-between gap-3 rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[#b91c1c]">
          <span>
            {loadError ??
              "Loja não encontrada."}
          </span>

          <button
            onClick={load}
            className="font-semibold underline shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const storeUrl = `/loja/${encodeURIComponent(
    form.slug.trim()
  )}`;

  /*
   * O domínio mostrado antes era "lojapro.com.br" escrito no código,
   * mesmo quando o site rodava em outro endereço. Agora vem do próprio
   * navegador, então acerta em produção, em pré-visualização e no
   * ambiente local, sem ninguém precisar lembrar de trocar.
   */
  const dominioPublico =
    typeof window !== "undefined"
      ? window.location.host.replace(/^www\./, "")
      : "moneynotopo.com.br";

  return (
    <div className="p-4 sm:p-6 max-w-[860px]">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-[#e4e4e7]">
        <div className="flex items-center gap-3">
          <div
            className={`t-corpo flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-medium border ${
              form.ativo
                ? "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                : "bg-[#f4f4f5] text-[#52525b] border-[#e4e4e7]"
            }`}
          >
            <Globe
              size={13}
              strokeWidth={2}
            />

            {form.ativo
              ? "Loja publicada"
              : "Loja offline"}
          </div>

          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="t-corpo flex items-center gap-1 text-[#6b7280] hover:text-[#0f1117]"
          >
            {form.slug || "sua-loja"}
            <ExternalLink
              size={12}
              strokeWidth={2}
            />
          </a>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              if (!form.slug.trim()) {
                return;
              }

              window.open(
                storeUrl,
                "_blank",
                "noopener,noreferrer"
              );
            }}
            className="t-corpo toque flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-1.5 font-medium text-[#374151] border border-[#e4e4e7] rounded-lg sm:rounded-[6px] bg-white hover:bg-[#f4f4f5] active:scale-[0.98] transition-all"
          >
            <Eye
              size={14}
              strokeWidth={1.8}
            />

            Visualizar
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="t-corpo toque flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-1.5 text-white bg-[#0f1117] sm:bg-[#16a34a] rounded-lg sm:rounded-[6px] hover:opacity-90 active:scale-[0.98] transition-all font-semibold disabled:opacity-60"
          >
            {saving ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : saved ? (
              <CheckCircle2
                size={14}
                strokeWidth={2}
              />
            ) : (
              <Save
                size={14}
                strokeWidth={2}
              />
            )}

            {saving
              ? "Salvando..."
              : saved
              ? "Salvo"
              : "Salvar"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="t-corpo mb-4 rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-[#b91c1c]">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="t-corpo font-semibold text-[#0f1117]">
                Informações públicas
              </h2>
              <p className="t-apoio mt-0.5 text-[#6b7280] leading-snug">
                Tudo desta seção aparece na sua loja, em "Sobre a loja", para
                quem está comprando.
              </p>
            </div>

            <div className="px-4 py-4 space-y-4">
              <Campo
                label="Nome da loja"
                value={form.nome}
                onChange={(v) => setForm((f) => ({ ...f, nome: v }))}
                placeholder="Nome da loja"
              />

              <div>
                <label className="t-corpo block font-medium text-[#374151] mb-1">
                  Endereço da loja (slug)
                </label>

                <div className="flex items-center border border-[#e4e4e7] rounded-[6px] overflow-hidden focus-within:ring-1 focus-within:ring-[#16a34a] focus-within:border-[#16a34a]">
                  <span className="t-corpo px-3 py-1.5 bg-[#f4f4f5] text-[#6b7280] border-r border-[#e4e4e7] whitespace-nowrap">
                    {dominioPublico}/
                  </span>

                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        slug: e.target.value,
                      }))
                    }
                    className="t-corpo flex-1 min-w-0 px-3 py-1.5 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <Campo
                label="Descrição"
                value={form.descricao}
                onChange={(v) => setForm((f) => ({ ...f, descricao: v }))}
                rows={3}
                placeholder="Descreva sua loja..."
              />
            </div>
          </section>

          {/* Contato */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="t-corpo font-semibold text-[#0f1117]">
                Contato
              </h2>
            </div>

            <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))}
                placeholder="(00) 00000-0000"
              />

              <Campo
                label="E-mail de contato"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                type="email"
                placeholder="contato@loja.com"
              />
            </div>
          </section>

          {/* Endereço de envio (origem das encomendas) */}
          <EnderecoOrigemSection form={form} setForm={setForm} />

          {/* Políticas */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="t-corpo font-semibold text-[#0f1117]">
                Políticas · públicas
              </h2>
              <p className="t-apoio mt-0.5 text-[#6b7280] leading-snug">
                O cliente lê isto antes de comprar. Loja sem política de troca
                escrita gera mais dúvida no WhatsApp do que venda.
              </p>
            </div>

            <div className="px-4 py-4 space-y-4">
              <Campo
                label="Política de trocas e devoluções"
                value={form.politica_troca}
                onChange={(v) => setForm((f) => ({ ...f, politica_troca: v }))}
                rows={3}
              />

              <Campo
                label="Política de frete"
                value={form.politica_frete}
                onChange={(v) => setForm((f) => ({ ...f, politica_frete: v }))}
                rows={3}
              />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Endereço da loja e pedido de domínio próprio.
              Fica no topo da coluna porque é a primeira pergunta de
              quem acabou de montar a loja: "qual é o link?" */}
          <DominioProprio />

          {/* Configurações */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="t-corpo font-semibold text-[#0f1117]">
                Configurações
              </h2>
            </div>

            <div className="px-4 py-2">
              <Chave
                label="Loja ativa"
                description="Exibir loja para visitantes"
                ligado={form.ativo}
                onAlternar={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />

              <Chave
                label="Controle de estoque"
                description="Bloquear compra sem estoque"
                ligado={form.manter_estoque}
                onAlternar={(v) => setForm((f) => ({ ...f, manter_estoque: v }))}
              />

              <Chave
                label="Exibir sem estoque"
                description="Mostrar produtos esgotados"
                ligado={form.exibir_sem_estoque}
                onAlternar={(v) => setForm((f) => ({ ...f, exibir_sem_estoque: v }))}
              />
            </div>
          </section>

          {/* Plano */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="t-corpo font-semibold text-[#0f1117]">
                Plano atual
              </h2>
            </div>

            <div className="px-4 py-4">
              <p className="t-corpo font-semibold text-[#0f1117] mb-0.5">
                {store.plano
                  ? store.plano
                      .charAt(0)
                      .toUpperCase() +
                    store.plano.slice(1)
                  : "Gratuito"}
              </p>

              <p className="t-corpo text-[#6b7280] mb-3">
                {store.plano_renovacao
                  ? `Renovação em ${new Date(
                      store.plano_renovacao
                    ).toLocaleDateString(
                      "pt-BR"
                    )}`
                  : "Sem renovação agendada"}
              </p>

              <button
                type="button"
                className="t-corpo w-full px-3 py-1.5 text-[#374151] border border-[#e4e4e7] rounded-[6px] bg-white hover:bg-[#f4f4f5] transition-colors"
              >
                Gerenciar plano
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
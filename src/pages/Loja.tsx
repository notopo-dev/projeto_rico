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

  function Field({
    label,
    name,
    type = "text",
    placeholder = "",
    rows = 0,
  }: {
    label: string;
    name: keyof LojaFormData;
    type?: string;
    placeholder?: string;
    rows?: number;
  }) {
    const value = form[name] as string;

    const cls =
      "w-full px-3 py-1.5 text-[13px] border border-[#e4e4e7] rounded-[6px] bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]";

    return (
      <div>
        <label className="block text-[12px] font-medium text-[#374151] mb-1">
          {label}
        </label>

        {rows > 0 ? (
          <textarea
            rows={rows}
            value={value}
            placeholder={placeholder}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                [name]: e.target.value,
              }))
            }
            className={
              cls + " resize-none"
            }
          />
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                [name]: e.target.value,
              }))
            }
            className={cls}
          />
        )}
      </div>
    );
  }

  function Toggle({
    label,
    description,
    name,
  }: {
    label: string;
    description: string;
    name: keyof LojaFormData;
  }) {
    const val = form[name] as boolean;

    return (
      <div className="flex items-center justify-between gap-4 py-3 border-b border-[#f4f4f5] last:border-0">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#0f1117]">
            {label}
          </p>

          <p className="text-[12px] text-[#6b7280]">
            {description}
          </p>
        </div>

        <button
          type="button"
          aria-pressed={val}
          onClick={() =>
            setForm((f) => ({
              ...f,
              [name]: !val,
            }))
          }
          className={`relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            val
              ? "bg-[#16a34a] focus-visible:ring-[#16a34a]"
              : "bg-[#d1d5db] focus-visible:ring-[#9ca3af]"
          }`}
        >
          <span
            className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
              val ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-[860px]">
        <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
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
      <div className="p-6 max-w-[860px]">
        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
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

  return (
    <div className="p-6 max-w-[860px]">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#e4e4e7]">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[12px] font-medium border ${
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
            className="flex items-center gap-1 text-[12px] text-[#6b7280] hover:text-[#0f1117]"
          >
            {form.slug || "sua-loja"}
            <ExternalLink
              size={12}
              strokeWidth={2}
            />
          </a>
        </div>

        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[#374151] border border-[#e4e4e7] rounded-[6px] bg-white hover:bg-[#f4f4f5] transition-colors"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-white bg-[#16a34a] rounded-[6px] hover:bg-[#15803d] transition-colors font-medium disabled:opacity-60"
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
        <div className="mb-4 rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-[13px] text-[#b91c1c]">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="text-[13px] font-semibold text-[#0f1117]">
                Informações da loja
              </h2>
            </div>

            <div className="px-4 py-4 space-y-4">
              <Field
                label="Nome da loja"
                name="nome"
                placeholder="Nome da loja"
              />

              <div>
                <label className="block text-[12px] font-medium text-[#374151] mb-1">
                  Endereço da loja (slug)
                </label>

                <div className="flex items-center border border-[#e4e4e7] rounded-[6px] overflow-hidden focus-within:ring-1 focus-within:ring-[#16a34a] focus-within:border-[#16a34a]">
                  <span className="px-3 py-1.5 bg-[#f4f4f5] text-[12px] text-[#6b7280] border-r border-[#e4e4e7] whitespace-nowrap">
                    lojapro.com.br/
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
                    className="flex-1 min-w-0 px-3 py-1.5 text-[13px] bg-white focus:outline-none"
                  />
                </div>
              </div>

              <Field
                label="Descrição"
                name="descricao"
                rows={3}
                placeholder="Descreva sua loja..."
              />
            </div>
          </section>

          {/* Contato */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="text-[13px] font-semibold text-[#0f1117]">
                Contato
              </h2>
            </div>

            <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="WhatsApp"
                name="whatsapp"
                placeholder="(00) 00000-0000"
              />

              <Field
                label="E-mail de contato"
                name="email"
                type="email"
                placeholder="contato@loja.com"
              />
            </div>
          </section>

          {/* Políticas */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="text-[13px] font-semibold text-[#0f1117]">
                Políticas
              </h2>
            </div>

            <div className="px-4 py-4 space-y-4">
              <Field
                label="Política de trocas e devoluções"
                name="politica_troca"
                rows={3}
              />

              <Field
                label="Política de frete"
                name="politica_frete"
                rows={3}
              />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Configurações */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="text-[13px] font-semibold text-[#0f1117]">
                Configurações
              </h2>
            </div>

            <div className="px-4 py-2">
              <Toggle
                label="Loja ativa"
                description="Exibir loja para visitantes"
                name="ativo"
              />

              <Toggle
                label="Controle de estoque"
                description="Bloquear compra sem estoque"
                name="manter_estoque"
              />

              <Toggle
                label="Exibir sem estoque"
                description="Mostrar produtos esgotados"
                name="exibir_sem_estoque"
              />
            </div>
          </section>

          {/* Plano */}
          <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
            <div className="px-4 py-3 border-b border-[#e4e4e7]">
              <h2 className="text-[13px] font-semibold text-[#0f1117]">
                Plano atual
              </h2>
            </div>

            <div className="px-4 py-4">
              <p className="text-[13px] font-semibold text-[#0f1117] mb-0.5">
                {store.plano
                  ? store.plano
                      .charAt(0)
                      .toUpperCase() +
                    store.plano.slice(1)
                  : "Gratuito"}
              </p>

              <p className="text-[12px] text-[#6b7280] mb-3">
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
                className="w-full px-3 py-1.5 text-[13px] text-[#374151] border border-[#e4e4e7] rounded-[6px] bg-white hover:bg-[#f4f4f5] transition-colors"
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
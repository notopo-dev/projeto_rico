import { useState, useEffect, useRef } from "react";
import {
  Save,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  MessageCircle,
  CreditCard,
  Shuffle,
  Info,
} from "lucide-react";
import {
  getStoreCustomization,
  updateStoreCustomization,
  uploadStoreAsset,
} from "../lib/storeCustomizationApi";
import {
  getStoreSettings,
  updateNotificacoes,
  updateIntegracoes,
  getDadosConta,
  updateNomeConta,
  alterarSenha,
  alterarEmail,
} from "../lib/settingsApi";

type Tab = "conta" | "loja" | "notificacoes" | "integracoes";

const tabs: { id: Tab; label: string }[] = [
  { id: "conta", label: "Conta" },
  { id: "loja", label: "Aparência" },
  { id: "notificacoes", label: "Notificações" },
  { id: "integracoes", label: "Integrações" },
];

function SaveButton({
  onSave,
  saving,
  saved,
}: {
  onSave: () => void;
  saving?: boolean;
  saved: boolean;
}) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="flex min-h-11 w-full items-center justify-center gap-1.5 px-3 py-2 text-[13px] text-white bg-[#16a34a] rounded-xl hover:bg-[#15803d] transition-colors font-medium sm:w-auto lg:min-h-0 lg:py-1.5 lg:rounded-[6px] disabled:opacity-60"
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin" />
      ) : saved ? (
        <CheckCircle2 size={14} strokeWidth={2} />
      ) : (
        <Save size={14} strokeWidth={2} />
      )}
      {saving ? "Salvando..." : saved ? "Salvo" : "Salvar alterações"}
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-3 border-b border-[#e4e4e7]">
      <h2 className="text-[13px] font-semibold text-[#0f1117]">{title}</h2>
      {description && <p className="text-[12px] text-[#6b7280] mt-0.5">{description}</p>}
    </div>
  );
}

function Mensagem({ tipo, texto }: { tipo: "erro" | "sucesso"; texto: string }) {
  const cls =
    tipo === "erro"
      ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
      : "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]";
  return (
    <div className={`rounded-[6px] border px-4 py-2.5 text-[13px] ${cls}`}>{texto}</div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#374151] mb-1">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-11 px-3 py-2 text-base border border-[#e4e4e7] rounded-xl bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] lg:min-h-0 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280]"
          >
            {show ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-[#9ca3af]">{hint}</p>}
    </div>
  );
}

function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#f4f4f5] last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#0f1117]">{label}</p>
        <p className="text-[12px] text-[#6b7280]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-[22px] shrink-0 rounded-full transition-colors ${value ? "bg-[#16a34a]" : "bg-[#d1d5db]"}`}
      >
        <span className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
      </button>
    </div>
  );
}

export default function Configuracoes() {
  const [tab, setTab] = useState<Tab>("conta");

  // ============================================================
  // ABA CONTA
  // ============================================================
  const [conta, setConta] = useState({ nome: "", email: "", senha: "", confirmSenha: "" });
  const [emailOriginal, setEmailOriginal] = useState("");
  const [loadingConta, setLoadingConta] = useState(true);
  const [savingConta, setSavingConta] = useState(false);
  const [savedConta, setSavedConta] = useState(false);
  const [erroConta, setErroConta] = useState<string | null>(null);
  const [avisoConta, setAvisoConta] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "conta") return;
    let mounted = true;
    setLoadingConta(true);
    getDadosConta()
      .then((d) => {
        if (!mounted) return;
        setConta((c) => ({ ...c, nome: d.nome, email: d.email }));
        setEmailOriginal(d.email);
      })
      .catch((err) => {
        if (mounted) setErroConta(err instanceof Error ? err.message : "Erro ao carregar conta.");
      })
      .finally(() => {
        if (mounted) setLoadingConta(false);
      });
    return () => { mounted = false; };
  }, [tab]);

  async function handleSaveConta() {
    setErroConta(null);
    setAvisoConta(null);

    if (!conta.nome.trim()) {
      setErroConta("O nome é obrigatório.");
      return;
    }

    if (conta.senha || conta.confirmSenha) {
      if (conta.senha.length < 6) {
        setErroConta("A nova senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (conta.senha !== conta.confirmSenha) {
        setErroConta("As senhas não conferem.");
        return;
      }
    }

    setSavingConta(true);
    try {
      await updateNomeConta(conta.nome.trim());

      if (conta.email !== emailOriginal) {
        await alterarEmail(conta.email);
        setAvisoConta(
          "Enviamos um e-mail de confirmação para o novo endereço. A troca só é efetivada após você confirmar."
        );
      }

      if (conta.senha) {
        await alterarSenha(conta.senha);
        setConta((c) => ({ ...c, senha: "", confirmSenha: "" }));
      }

      setSavedConta(true);
      setTimeout(() => setSavedConta(false), 2500);
    } catch (err) {
      setErroConta(err instanceof Error ? err.message : "Erro ao salvar conta.");
    } finally {
      setSavingConta(false);
    }
  }

  // ============================================================
  // ABA APARÊNCIA
  // ============================================================
  const [aparencia, setAparencia] = useState({
    corPrimaria: "#16a34a",
    corSecundaria: "#0f1117",
    logoUrl: null as string | null,
    bannerUrl: null as string | null,
    modoCompra: "whatsapp" as "whatsapp" | "pagamento" | "ambos",
  });
  const [loadingAparencia, setLoadingAparencia] = useState(true);
  const [loadErrorAparencia, setLoadErrorAparencia] = useState<string | null>(null);
  const [savingAparencia, setSavingAparencia] = useState(false);
  const [savedAparencia, setSavedAparencia] = useState(false);
  const [saveErrorAparencia, setSaveErrorAparencia] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== "loja") return;
    let mounted = true;
    setLoadingAparencia(true);
    setLoadErrorAparencia(null);
    getStoreCustomization()
      .then((data) => {
        if (!mounted) return;
        setAparencia({
          corPrimaria: data.cor_primaria,
          corSecundaria: data.cor_secundaria,
          logoUrl: data.logo_url,
          bannerUrl: data.banner_url,
          modoCompra: data.modo_compra,
        });
      })
      .catch((err) => {
        if (mounted) {
          setLoadErrorAparencia(
            err instanceof Error ? err.message : "Erro ao carregar aparência."
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingAparencia(false);
      });
    return () => { mounted = false; };
  }, [tab]);

  async function handleUploadLogo(file: File) {
    setUploadingLogo(true);
    setSaveErrorAparencia(null);
    try {
      const url = await uploadStoreAsset(file, "logo");
      setAparencia((a) => ({ ...a, logoUrl: url }));
    } catch (err) {
      setSaveErrorAparencia(err instanceof Error ? err.message : "Erro ao enviar logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUploadBanner(file: File) {
    setUploadingBanner(true);
    setSaveErrorAparencia(null);
    try {
      const url = await uploadStoreAsset(file, "banner");
      setAparencia((a) => ({ ...a, bannerUrl: url }));
    } catch (err) {
      setSaveErrorAparencia(err instanceof Error ? err.message : "Erro ao enviar banner.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSaveAparencia() {
    setSaveErrorAparencia(null);
    setSavingAparencia(true);
    try {
      await updateStoreCustomization({
        cor_primaria: aparencia.corPrimaria,
        cor_secundaria: aparencia.corSecundaria,
        logo_url: aparencia.logoUrl,
        banner_url: aparencia.bannerUrl,
        modo_compra: aparencia.modoCompra,
      });
      setSavedAparencia(true);
      setTimeout(() => setSavedAparencia(false), 2500);
    } catch (err) {
      setSaveErrorAparencia(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSavingAparencia(false);
    }
  }

  // ============================================================
  // ABAS NOTIFICAÇÕES + INTEGRAÇÕES (store_settings)
  // ============================================================
  const [notif, setNotif] = useState({
    notif_novo_pedido: false,
    notif_pedido_cancelado: false,
    notif_estoque_minimo: false,
    notif_novo_cliente: false,
    notif_relatorio_semanal: false,
    notif_marketing: false,
  });
  const [integ, setInteg] = useState({
    melhor_envio_token: "",
    correios_login: "",
    pix_chave: "",
    mercado_pago_token: "",
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [erroSettings, setErroSettings] = useState<string | null>(null);

  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);
  const [savingInteg, setSavingInteg] = useState(false);
  const [savedInteg, setSavedInteg] = useState(false);

  useEffect(() => {
    if (tab !== "notificacoes" && tab !== "integracoes") return;
    let mounted = true;
    setLoadingSettings(true);
    setErroSettings(null);
    getStoreSettings()
      .then((s) => {
        if (!mounted) return;
        setNotif({
          notif_novo_pedido: s.notif_novo_pedido,
          notif_pedido_cancelado: s.notif_pedido_cancelado,
          notif_estoque_minimo: s.notif_estoque_minimo,
          notif_novo_cliente: s.notif_novo_cliente,
          notif_relatorio_semanal: s.notif_relatorio_semanal,
          notif_marketing: s.notif_marketing,
        });
        setInteg({
          melhor_envio_token: s.melhor_envio_token ?? "",
          correios_login: s.correios_login ?? "",
          pix_chave: s.pix_chave ?? "",
          mercado_pago_token: s.mercado_pago_token ?? "",
        });
      })
      .catch((err) => {
        if (mounted) {
          setErroSettings(err instanceof Error ? err.message : "Erro ao carregar configurações.");
        }
      })
      .finally(() => {
        if (mounted) setLoadingSettings(false);
      });
    return () => { mounted = false; };
  }, [tab]);

  async function handleSaveNotif() {
    setErroSettings(null);
    setSavingNotif(true);
    try {
      await updateNotificacoes(notif);
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 2500);
    } catch (err) {
      setErroSettings(err instanceof Error ? err.message : "Erro ao salvar notificações.");
    } finally {
      setSavingNotif(false);
    }
  }

  async function handleSaveInteg() {
    setErroSettings(null);
    setSavingInteg(true);
    try {
      await updateIntegracoes(integ);
      setSavedInteg(true);
      setTimeout(() => setSavedInteg(false), 2500);
    } catch (err) {
      setErroSettings(err instanceof Error ? err.message : "Erro ao salvar integrações.");
    } finally {
      setSavingInteg(false);
    }
  }

  return (
    <div className="w-full min-h-full px-3 py-3 sm:px-4 lg:max-w-[860px] lg:px-6 lg:py-6">
      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-5 overflow-x-auto border-b border-[#e4e4e7] lg:mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-10 shrink-0 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors lg:min-h-0 ${tab === t.id ? "border-[#16a34a] text-[#15803d]" : "border-transparent text-[#6b7280] hover:text-[#0f1117]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ======================= CONTA ======================= */}
      {tab === "conta" && (
        <div className="space-y-4">
          {loadingConta ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader title="Informações pessoais" />
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Nome"
                    value={conta.nome}
                    onChange={(v) => setConta((c) => ({ ...c, nome: v }))}
                  />
                  <Field
                    label="E-mail"
                    value={conta.email}
                    onChange={(v) => setConta((c) => ({ ...c, email: v }))}
                    type="email"
                    hint={
                      conta.email !== emailOriginal
                        ? "Você receberá um e-mail de confirmação no novo endereço."
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader
                  title="Alterar senha"
                  description="Deixe em branco se não quiser mudar a senha."
                />
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Nova senha"
                    value={conta.senha}
                    onChange={(v) => setConta((c) => ({ ...c, senha: v }))}
                    type="password"
                    hint="Mínimo de 6 caracteres."
                  />
                  <Field
                    label="Confirmar senha"
                    value={conta.confirmSenha}
                    onChange={(v) => setConta((c) => ({ ...c, confirmSenha: v }))}
                    type="password"
                  />
                </div>
              </div>

              {erroConta && <Mensagem tipo="erro" texto={erroConta} />}
              {avisoConta && <Mensagem tipo="sucesso" texto={avisoConta} />}

              <div className="flex justify-end">
                <SaveButton onSave={handleSaveConta} saving={savingConta} saved={savedConta} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================= APARÊNCIA ======================= */}
      {tab === "loja" && (
        <div className="space-y-4">
          {loadingAparencia ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : loadErrorAparencia ? (
            <Mensagem tipo="erro" texto={loadErrorAparencia} />
          ) : (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3.5 py-3 text-[12px] text-[#1e40af]">
                <Info size={15} className="shrink-0 mt-0.5" />
                <span>
                  Nome, descrição, WhatsApp e políticas da loja ficam na aba{" "}
                  <strong>Loja</strong>, no menu lateral. Aqui você personaliza só a
                  aparência e como o cliente finaliza a compra.
                </span>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader title="Cores da loja" description="Refletem imediatamente na loja pública." />
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Cor principal
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={aparencia.corPrimaria}
                        onChange={(e) => setAparencia((a) => ({ ...a, corPrimaria: e.target.value }))}
                        className="w-11 h-11 border border-[#e4e4e7] rounded-lg cursor-pointer lg:w-9 lg:h-9"
                      />
                      <input
                        type="text"
                        value={aparencia.corPrimaria}
                        onChange={(e) => setAparencia((a) => ({ ...a, corPrimaria: e.target.value }))}
                        className="min-h-11 flex-1 px-3 py-2 text-base font-mono border border-[#e4e4e7] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#16a34a] lg:min-h-0 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Cor secundária
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={aparencia.corSecundaria}
                        onChange={(e) => setAparencia((a) => ({ ...a, corSecundaria: e.target.value }))}
                        className="w-11 h-11 border border-[#e4e4e7] rounded-lg cursor-pointer lg:w-9 lg:h-9"
                      />
                      <input
                        type="text"
                        value={aparencia.corSecundaria}
                        onChange={(e) => setAparencia((a) => ({ ...a, corSecundaria: e.target.value }))}
                        className="min-h-11 flex-1 px-3 py-2 text-base font-mono border border-[#e4e4e7] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#16a34a] lg:min-h-0 lg:py-1.5 lg:text-[13px] lg:rounded-[6px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader title="Logo e banner" />
                <div className="px-4 py-4 space-y-5">
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                      Logo da loja
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl border border-[#e4e4e7] bg-[#fafafa] overflow-hidden flex items-center justify-center shrink-0">
                        {aparencia.logoUrl ? (
                          <img src={aparencia.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Upload size={18} className="text-[#d4d4d8]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="min-h-11 px-3.5 text-[13px] font-medium text-[#374151] border border-[#e4e4e7] rounded-xl bg-white hover:bg-[#f4f4f5] disabled:opacity-60 flex items-center gap-1.5 lg:min-h-0 lg:h-9 lg:rounded-[6px]"
                      >
                        {uploadingLogo && <Loader2 size={13} className="animate-spin" />}
                        {uploadingLogo ? "Enviando..." : aparencia.logoUrl ? "Trocar logo" : "Anexar logo"}
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadLogo(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                      Banner da loja
                    </label>
                    <div className="space-y-2">
                      {aparencia.bannerUrl && (
                        <div className="w-full aspect-[16/6] rounded-xl overflow-hidden border border-[#e4e4e7] bg-[#fafafa]">
                          <img src={aparencia.bannerUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={uploadingBanner}
                        className="min-h-11 px-3.5 text-[13px] font-medium text-[#374151] border border-[#e4e4e7] rounded-xl bg-white hover:bg-[#f4f4f5] disabled:opacity-60 flex items-center gap-1.5 lg:min-h-0 lg:h-9 lg:rounded-[6px]"
                      >
                        {uploadingBanner && <Loader2 size={13} className="animate-spin" />}
                        {uploadingBanner ? "Enviando..." : aparencia.bannerUrl ? "Trocar banner" : "Anexar banner"}
                      </button>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadBanner(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader
                  title="Como o cliente vai comprar"
                  description='Define o que acontece quando o cliente toca em "Finalizar pedido" na sua loja.'
                />
                <div className="px-4 py-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setAparencia((a) => ({ ...a, modoCompra: "whatsapp" }))}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-colors ${
                      aparencia.modoCompra === "whatsapp"
                        ? "border-[#16a34a] bg-[#f0fdf4]"
                        : "border-[#e4e4e7] bg-white"
                    }`}
                  >
                    <MessageCircle size={19} className="text-[#16a34a] shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-[#111827]">Somente WhatsApp</p>
                      <p className="text-[11px] text-[#6b7280]">
                        O pedido é enviado direto pro WhatsApp cadastrado em "Loja"
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAparencia((a) => ({ ...a, modoCompra: "pagamento" }))}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-colors ${
                      aparencia.modoCompra === "pagamento"
                        ? "border-[#16a34a] bg-[#f0fdf4]"
                        : "border-[#e4e4e7] bg-white"
                    }`}
                  >
                    <CreditCard size={19} className="text-[#374151] shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-[#111827]">
                        Somente pagamento na loja
                      </p>
                      <p className="text-[11px] text-[#6b7280]">
                        Cliente paga com Pix ou cartão direto no site
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAparencia((a) => ({ ...a, modoCompra: "ambos" }))}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-colors ${
                      aparencia.modoCompra === "ambos"
                        ? "border-[#16a34a] bg-[#f0fdf4]"
                        : "border-[#e4e4e7] bg-white"
                    }`}
                  >
                    <Shuffle size={19} className="text-[#374151] shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-[#111827]">Cliente escolhe</p>
                      <p className="text-[11px] text-[#6b7280]">
                        Mostra WhatsApp e pagamento no checkout
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {saveErrorAparencia && <Mensagem tipo="erro" texto={saveErrorAparencia} />}

              <div className="flex justify-end">
                <SaveButton
                  onSave={handleSaveAparencia}
                  saving={savingAparencia}
                  saved={savedAparencia}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================= NOTIFICAÇÕES ======================= */}
      {tab === "notificacoes" && (
        <div className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader
                  title="Notificações por e-mail"
                  description="Escolha quais eventos geram notificações."
                />
                <div className="px-4 py-1">
                  <Toggle
                    label="Novo pedido"
                    description="Receber ao confirmar um pedido"
                    value={notif.notif_novo_pedido}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_novo_pedido: v }))}
                  />
                  <Toggle
                    label="Pedido cancelado"
                    description="Receber ao cancelar um pedido"
                    value={notif.notif_pedido_cancelado}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_pedido_cancelado: v }))}
                  />
                  <Toggle
                    label="Alerta de estoque mínimo"
                    description="Receber quando produto atingir o mínimo"
                    value={notif.notif_estoque_minimo}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_estoque_minimo: v }))}
                  />
                  <Toggle
                    label="Novo cliente cadastrado"
                    description="Receber ao registrar um novo cliente"
                    value={notif.notif_novo_cliente}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_novo_cliente: v }))}
                  />
                  <Toggle
                    label="Relatório semanal"
                    description="Resumo de vendas toda segunda-feira"
                    value={notif.notif_relatorio_semanal}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_relatorio_semanal: v }))}
                  />
                  <Toggle
                    label="E-mails de marketing"
                    description="Dicas, novidades e promoções da plataforma"
                    value={notif.notif_marketing}
                    onChange={(v) => setNotif((n) => ({ ...n, notif_marketing: v }))}
                  />
                </div>
              </div>

              {erroSettings && <Mensagem tipo="erro" texto={erroSettings} />}

              <div className="flex justify-end">
                <SaveButton onSave={handleSaveNotif} saving={savingNotif} saved={savedNotif} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================= INTEGRAÇÕES ======================= */}
      {tab === "integracoes" && (
        <div className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader title="Frete" />
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Token Melhor Envio"
                    value={integ.melhor_envio_token}
                    onChange={(v) => setInteg((i) => ({ ...i, melhor_envio_token: v }))}
                    type="password"
                    placeholder="Token de acesso"
                  />
                  <Field
                    label="Login Correios (SIGEP)"
                    value={integ.correios_login}
                    onChange={(v) => setInteg((i) => ({ ...i, correios_login: v }))}
                    placeholder="CNPJ ou login"
                  />
                </div>
              </div>

              <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
                <SectionHeader
                  title="Outros meios de pagamento"
                  description="Configurações adicionais, se sua loja também usar outros provedores."
                />
                <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Chave Pix"
                    value={integ.pix_chave}
                    onChange={(v) => setInteg((i) => ({ ...i, pix_chave: v }))}
                    placeholder="CPF, CNPJ, e-mail ou telefone"
                  />
                  <Field
                    label="Token Mercado Pago"
                    value={integ.mercado_pago_token}
                    onChange={(v) => setInteg((i) => ({ ...i, mercado_pago_token: v }))}
                    type="password"
                    placeholder="Access token"
                  />
                </div>
              </div>

              {erroSettings && <Mensagem tipo="erro" texto={erroSettings} />}

              <div className="flex justify-end">
                <SaveButton onSave={handleSaveInteg} saving={savingInteg} saved={savedInteg} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
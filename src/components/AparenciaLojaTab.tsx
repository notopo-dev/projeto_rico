import { useState, useEffect, useRef } from "react";
import { Loader2, Save, CheckCircle2, Upload } from "lucide-react";
import {
  getStoreCustomization,
  updateStoreCustomization,
  uploadStoreAsset,
} from "../lib/storeCustomizationApi";

/**
 * Aba de personalização visual da loja pública. Coloque este
 * componente dentro do seu Configuracoes.tsx, como mais uma aba
 * (ex: ao lado de "Conta", "Notificações", "Integrações").
 */
export default function AparenciaLojaTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [corPrimaria, setCorPrimaria] = useState("#16a34a");
  const [corSecundaria, setCorSecundaria] = useState("#0f1117");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [modoCompra, setModoCompra] = useState<"whatsapp" | "pagamento" | "ambos">(
    "whatsapp"
  );
  const [whatsapp, setWhatsapp] = useState("");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStoreCustomization()
      .then((data) => {
        setCorPrimaria(data.cor_primaria);
        setCorSecundaria(data.cor_secundaria);
        setLogoUrl(data.logo_url);
        setBannerUrl(data.banner_url);
        setModoCompra(data.modo_compra);
        setWhatsapp(data.whatsapp ?? "");
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "Erro ao carregar aparência."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleUploadLogo(file: File) {
    setUploadingLogo(true);
    setSaveError(null);
    try {
      const url = await uploadStoreAsset(file, "logo");
      setLogoUrl(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao enviar logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUploadBanner(file: File) {
    setUploadingBanner(true);
    setSaveError(null);
    try {
      const url = await uploadStoreAsset(file, "banner");
      setBannerUrl(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao enviar banner.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      await updateStoreCustomization({
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        modo_compra: modoCompra,
        whatsapp: whatsapp || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#6b7280] py-6">
        <Loader2 size={16} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cores */}
      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7]">
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            Cores da loja
          </h2>
        </div>
        <div className="px-4 py-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[#374151] mb-1">
              Cor principal
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-9 h-9 rounded border border-[#e4e4e7] cursor-pointer"
              />
              <input
                type="text"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="flex-1 px-3 py-1.5 text-[13px] font-mono border border-[#e4e4e7] rounded-[6px]"
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
                value={corSecundaria}
                onChange={(e) => setCorSecundaria(e.target.value)}
                className="w-9 h-9 rounded border border-[#e4e4e7] cursor-pointer"
              />
              <input
                type="text"
                value={corSecundaria}
                onChange={(e) => setCorSecundaria(e.target.value)}
                className="flex-1 px-3 py-1.5 text-[13px] font-mono border border-[#e4e4e7] rounded-[6px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logo e banner */}
      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7]">
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            Logo e banner
          </h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
              Logo da loja
            </label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl border border-[#e4e4e7] bg-[#fafafa] overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Upload size={16} className="text-[#d4d4d8]" />
                )}
              </div>
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="h-9 px-3 text-[12px] font-medium text-[#374151] border border-[#e4e4e7] rounded-[6px] bg-white hover:bg-[#f4f4f5] disabled:opacity-60 flex items-center gap-1.5"
              >
                {uploadingLogo && <Loader2 size={13} className="animate-spin" />}
                {uploadingLogo ? "Enviando..." : "Enviar logo"}
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
              {bannerUrl && (
                <div className="w-full aspect-[16/6] rounded-xl overflow-hidden border border-[#e4e4e7] bg-[#fafafa]">
                  <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="h-9 px-3 text-[12px] font-medium text-[#374151] border border-[#e4e4e7] rounded-[6px] bg-white hover:bg-[#f4f4f5] disabled:opacity-60 flex items-center gap-1.5"
              >
                {uploadingBanner && <Loader2 size={13} className="animate-spin" />}
                {uploadingBanner ? "Enviando..." : bannerUrl ? "Trocar banner" : "Enviar banner"}
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

      {/* Modo de compra */}
      <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
        <div className="px-4 py-3 border-b border-[#e4e4e7]">
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            Como o cliente vai comprar
          </h2>
          <p className="text-[12px] text-[#6b7280] mt-0.5">
            Defina o que acontece quando o cliente clicar em "Comprar" na sua loja.
          </p>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[
            { value: "whatsapp" as const, label: "Somente WhatsApp", desc: "O pedido é enviado direto pro seu WhatsApp" },
            { value: "pagamento" as const, label: "Somente pagamento online", desc: "Cliente paga com Pix ou cartão pelo site" },
            { value: "ambos" as const, label: "Cliente escolhe", desc: "Mostra as duas opções no checkout" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setModoCompra(opt.value)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-[8px] border-2 text-left transition-colors ${
                modoCompra === opt.value
                  ? "border-[#16a34a] bg-[#f0fdf4]"
                  : "border-[#e4e4e7] bg-white"
              }`}
            >
              <div>
                <p className="text-[13px] font-medium text-[#111827]">{opt.label}</p>
                <p className="text-[11px] text-[#6b7280]">{opt.desc}</p>
              </div>
            </button>
          ))}

          {(modoCompra === "whatsapp" || modoCompra === "ambos") && (
            <div className="pt-2">
              <label className="block text-[12px] font-medium text-[#374151] mb-1">
                WhatsApp para receber pedidos
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-1.5 text-[13px] border border-[#e4e4e7] rounded-[6px]"
              />
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-[13px] text-[#b91c1c]">
          {saveError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-white bg-[#16a34a] rounded-[6px] hover:bg-[#15803d] disabled:opacity-60 font-medium"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={14} />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Salvando..." : saved ? "Salvo" : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
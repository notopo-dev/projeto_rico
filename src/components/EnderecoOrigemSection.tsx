import { useState } from "react";
import { Loader2, MapPin, Info } from "lucide-react";
import { buscarEnderecoPorCep, type LojaFormData } from "../lib/lojaApi";

const estadosBR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

interface Props {
  form: LojaFormData;
  setForm: React.Dispatch<React.SetStateAction<LojaFormData>>;
}

function formatarCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Seção de endereço de origem da loja — de onde as encomendas
 * são postadas. Usado no cálculo de frete e na etiqueta.
 * Inclua dentro da tela Loja.
 */
export default function EnderecoOrigemSection({ form, setForm }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);

  async function handleCepChange(valor: string) {
    const formatado = formatarCep(valor);
    setForm((f) => ({ ...f, cep_origem: formatado }));
    setAvisoCep(null);

    const digitos = formatado.replace(/\D/g, "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarEnderecoPorCep(digitos);
      if (endereco) {
        setForm((f) => ({
          ...f,
          endereco_logradouro: endereco.logradouro || f.endereco_logradouro,
          endereco_bairro: endereco.bairro || f.endereco_bairro,
          endereco_cidade: endereco.cidade || f.endereco_cidade,
          endereco_uf: endereco.uf || f.endereco_uf,
        }));
      } else {
        setAvisoCep("CEP não encontrado. Preencha o endereço manualmente.");
      }
    } finally {
      setBuscandoCep(false);
    }
  }

  const inputCls =
    "w-full px-3 py-1.5 text-[13px] border border-[#e4e4e7] rounded-[6px] bg-white placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]";
  const labelCls = "block text-[12px] font-medium text-[#374151] mb-1";

  return (
    <section className="bg-white border border-[#e4e4e7] rounded-[6px]">
      <div className="px-4 py-3 border-b border-[#e4e4e7]">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-[#6b7280]" />
          <h2 className="text-[13px] font-semibold text-[#0f1117]">
            Endereço de envio
          </h2>
        </div>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          De onde suas encomendas são postadas. Usado para calcular o frete.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-[11px] text-[#1e40af]">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Sem esse endereço, seus clientes não conseguem calcular o frete no
            checkout.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>CEP</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={form.cep_origem}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className={inputCls}
              />
              {buscandoCep && (
                <Loader2
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[#9ca3af]"
                />
              )}
            </div>
            {avisoCep && (
              <p className="mt-1 text-[11px] text-[#b45309]">{avisoCep}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Logradouro</label>
            <input
              type="text"
              value={form.endereco_logradouro}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_logradouro: e.target.value }))
              }
              placeholder="Rua, avenida..."
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Número</label>
            <input
              type="text"
              value={form.endereco_numero}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_numero: e.target.value }))
              }
              placeholder="123"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Complemento (opcional)</label>
            <input
              type="text"
              value={form.endereco_complemento}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_complemento: e.target.value }))
              }
              placeholder="Sala, apto, galpão..."
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Bairro</label>
            <input
              type="text"
              value={form.endereco_bairro}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_bairro: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              type="text"
              value={form.endereco_cidade}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_cidade: e.target.value }))
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select
              value={form.endereco_uf}
              onChange={(e) =>
                setForm((f) => ({ ...f, endereco_uf: e.target.value }))
              }
              className={inputCls}
            >
              <option value="">—</option>
              {estadosBR.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
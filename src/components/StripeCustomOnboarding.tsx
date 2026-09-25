import { useState, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  Upload,
  ChevronRight,
  ChevronLeft,
  Building2,
  User,
} from "lucide-react";
import {
  salvarDadosStripeCustom,
  enviarDocumentoIdentidade,
  type DadosPessoaFisica,
  type DadosPessoaJuridica,
  type DadosContaBancaria,
} from "../lib/stripeCustomApi";

type Etapa = "tipo" | "dados" | "endereco" | "banco" | "documento" | "concluido";

const estadosBR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

// Bancos mais comuns no Brasil, com o código exigido pela Stripe.
// O código 110 é o banco fictício de testes da Stripe (sandbox) —
// use com agência 0000 e conta 0001234 para simular repasse OK.
const bancosBR = [
  { codigo: "110", nome: "Banco de TESTE (ambiente de teste)" },
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "341", nome: "Itaú" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "212", nome: "Banco Original" },
  { codigo: "756", nome: "Sicoob" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "422", nome: "Safra" },
  { codigo: "070", nome: "BRB" },
  { codigo: "085", nome: "Via Credi" },
  { codigo: "323", nome: "Mercado Pago" },
  { codigo: "380", nome: "PicPay" },
];

function inputCls() {
  return "w-full h-11 px-3 rounded-xl border border-[#e4e4e7] bg-white text-[14px] outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/10";
}

function labelCls() {
  return "block text-[12px] font-medium text-[#374151] mb-1";
}

function apenasDigitos(v: string) {
  return v.replace(/\D/g, "");
}

function formatarCpf(v: string) {
  const d = apenasDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarCnpj(v: string) {
  const d = apenasDigitos(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export interface DadosIniciaisOnboarding {
  tipoPessoa?: "individual" | "company" | null;
  nome?: string | null;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  razaoSocial?: string | null;
  endereco?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  } | null;
  temContaBancaria?: boolean;
}

interface StripeCustomOnboardingProps {
  /**
   * Dados já cadastrados na Stripe, para o lojista retomar ou
   * editar em vez de preencher tudo de novo do zero.
   */
  dadosIniciais?: DadosIniciaisOnboarding;
}

export default function StripeCustomOnboarding({
  dadosIniciais,
}: StripeCustomOnboardingProps = {}) {
  // Se já sabemos o tipo de pessoa, pula a primeira etapa
  const [etapa, setEtapa] = useState<Etapa>(
    dadosIniciais?.tipoPessoa ? "dados" : "tipo"
  );
  const [tipoPessoa, setTipoPessoa] = useState<"individual" | "company" | null>(
    dadosIniciais?.tipoPessoa ?? null
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [pf, setPf] = useState({
    first_name: dadosIniciais?.nome ?? "",
    last_name: dadosIniciais?.sobrenome ?? "",
    email: dadosIniciais?.email ?? "",
    phone: dadosIniciais?.telefone ?? "",
    cpf: "", // CPF nunca volta da Stripe (dado sensível) — precisa ser redigitado
    dataNasc: "", // idem
  });

  const [pj, setPj] = useState({
    name: dadosIniciais?.razaoSocial ?? "",
    cnpj: "", // CNPJ nunca volta da Stripe — precisa ser redigitado
    phone: dadosIniciais?.telefone ?? "",
  });
  const [rep, setRep] = useState({
    first_name: dadosIniciais?.nome ?? "",
    last_name: dadosIniciais?.sobrenome ?? "",
    email: dadosIniciais?.email ?? "",
    phone: dadosIniciais?.telefone ?? "",
    cpf: "",
    dataNasc: "",
  });

  const [endereco, setEndereco] = useState({
    line1: dadosIniciais?.endereco?.line1 ?? "",
    line2: dadosIniciais?.endereco?.line2 ?? "",
    city: dadosIniciais?.endereco?.city ?? "",
    state: dadosIniciais?.endereco?.state ?? "SP",
    postal_code: dadosIniciais?.endereco?.postal_code ?? "",
  });

  // Dados bancários: no Brasil a Stripe exige o "routing_number"
  // no formato <código do banco>-<agência> (ex: 341-1234), então
  // coletamos banco e agência separados e montamos o valor final.
  const [banco, setBanco] = useState({
    account_holder_name: "",
    codigoBanco: "110",
    agencia: "",
    digitoAgencia: "",
    account_number: "",
  });

  const [documentoFrente, setDocumentoFrente] = useState<File | null>(null);
  const [documentoVerso, setDocumentoVerso] = useState<File | null>(null);
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const frenteInputRef = useRef<HTMLInputElement>(null);
  const versoInputRef = useRef<HTMLInputElement>(null);

  function parseDataNasc(v: string) {
    const [dia, mes, ano] = v.split("/").map((n) => parseInt(n, 10));
    return { day: dia, month: mes, year: ano };
  }

  function formatarDataNasc(v: string) {
    const d = apenasDigitos(v).slice(0, 8);
    return d
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d{1,4})$/, "$1/$2");
  }

  function avancarDadosBasicos() {
    setErro(null);

    if (tipoPessoa === "individual") {
      if (!pf.first_name || !pf.last_name || !pf.email || !pf.phone || !pf.cpf || !pf.dataNasc) {
        setErro("Preencha todos os campos.");
        return;
      }
    } else {
      if (!pj.name || !pj.cnpj || !pj.phone) {
        setErro("Preencha os dados da empresa.");
        return;
      }
      if (!rep.first_name || !rep.last_name || !rep.email || !rep.phone || !rep.cpf || !rep.dataNasc) {
        setErro("Preencha os dados do responsável legal.");
        return;
      }
    }

    setEtapa("endereco");
  }

  async function avancarEndereco() {
    setErro(null);
    if (!endereco.line1 || !endereco.city || !endereco.postal_code) {
      setErro("Preencha o endereço completo.");
      return;
    }

    setSalvando(true);
    try {
      const enderecoStripe = {
        line1: endereco.line1,
        line2: endereco.line2 || undefined,
        city: endereco.city,
        state: endereco.state,
        postal_code: apenasDigitos(endereco.postal_code),
        country: "BR" as const,
      };

      if (tipoPessoa === "individual") {
        const individual: DadosPessoaFisica = {
          first_name: pf.first_name,
          last_name: pf.last_name,
          email: pf.email,
          phone: pf.phone,
          dob: parseDataNasc(pf.dataNasc),
          address: enderecoStripe,
          tax_id_individual: apenasDigitos(pf.cpf),
          political_exposure: "none",
        };
        await salvarDadosStripeCustom({
          tipoPessoa: "individual",
          individual,
          aceiteTermos: true,
        });
      } else {
        const company: DadosPessoaJuridica = {
          name: pj.name,
          tax_id: apenasDigitos(pj.cnpj),
          phone: pj.phone,
          address: enderecoStripe,
          representative: {
            first_name: rep.first_name,
            last_name: rep.last_name,
            email: rep.email,
            phone: rep.phone,
            dob: parseDataNasc(rep.dataNasc),
            address: enderecoStripe,
            tax_id_individual: apenasDigitos(rep.cpf),
            political_exposure: "none",
          },
        };
        await salvarDadosStripeCustom({
          tipoPessoa: "company",
          company,
          aceiteTermos: true,
        });
      }

      setEtapa("banco");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar dados.");
    } finally {
      setSalvando(false);
    }
  }

  async function avancarBanco() {
    setErro(null);
    if (!banco.account_holder_name || !banco.agencia || !banco.account_number) {
      setErro("Preencha os dados bancários.");
      return;
    }

    setSalvando(true);
    try {
      // Formato exigido pela Stripe no Brasil: xxx-xxxx ou xxx-xxxx-x
      // (código do banco com 3 dígitos + agência com 4 dígitos,
      // com dígito da agência opcional). Preenche com zeros à
      // esquerda porque agências curtas (ex: "123") são rejeitadas.
      const agencia = apenasDigitos(banco.agencia).padStart(4, "0");
      const digito = apenasDigitos(banco.digitoAgencia);
      const routingNumber = digito
        ? `${banco.codigoBanco}-${agencia}-${digito}`
        : `${banco.codigoBanco}-${agencia}`;

      const contaBancaria: DadosContaBancaria = {
        account_holder_name: banco.account_holder_name,
        routing_number: routingNumber,
        account_number: apenasDigitos(banco.account_number),
      };
      await salvarDadosStripeCustom({
        tipoPessoa: tipoPessoa!,
        contaBancaria,
      });
      setEtapa("documento");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar dados bancários.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarDocumentos() {
    setErro(null);
    if (!documentoFrente) {
      setErro("Envie a frente do documento.");
      return;
    }

    setEnviandoDoc(true);
    try {
      await enviarDocumentoIdentidade(documentoFrente, "front");
      if (documentoVerso) {
        await enviarDocumentoIdentidade(documentoVerso, "back");
      }
      setEtapa("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar documento.");
    } finally {
      setEnviandoDoc(false);
    }
  }

  /**
   * Usa o token mágico da Stripe para simular um documento
   * aprovado, sem precisar enviar imagem real. Só faz sentido
   * em ambiente de teste (sandbox).
   */
  async function enviarDocumentoDeTeste() {
    setErro(null);
    setEnviandoDoc(true);
    try {
      await enviarDocumentoIdentidade(null, "front", "file_identity_document_success");
      setEtapa("concluido");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar documento de teste.");
    } finally {
      setEnviandoDoc(false);
    }
  }

  const etapas: Etapa[] = ["tipo", "dados", "endereco", "banco", "documento"];
  const etapaIndex = etapas.indexOf(etapa);

  return (
    <div className="bg-white border border-[#e4e4e7] rounded-[6px]">
      <div className="px-4 py-3 border-b border-[#e4e4e7]">
        <h2 className="text-[13px] font-semibold text-[#0f1117]">
          Receber pagamentos com cartão
        </h2>
        <p className="text-[12px] text-[#6b7280] mt-0.5">
          Preencha seus dados para começar a receber pagamentos direto na sua conta.
        </p>
      </div>

      {etapa !== "concluido" && (
        <div className="flex items-center gap-1.5 px-4 pt-3">
          {etapas.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= etapaIndex ? "bg-[#16a34a]" : "bg-[#e4e4e7]"
              }`}
            />
          ))}
        </div>
      )}

      <div className="px-4 py-4">
        {etapa === "tipo" && (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-[#374151] mb-2">
              Como você quer se cadastrar?
            </p>
            <button
              onClick={() => {
                setTipoPessoa("individual");
                setEtapa("dados");
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-[#e4e4e7] hover:border-[#16a34a] transition-colors text-left"
            >
              <User size={22} className="text-[#374151] shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">
                  Pessoa física
                </p>
                <p className="text-[11px] text-[#6b7280]">
                  Vou me cadastrar com meu CPF
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setTipoPessoa("company");
                setEtapa("dados");
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-[#e4e4e7] hover:border-[#16a34a] transition-colors text-left"
            >
              <Building2 size={22} className="text-[#374151] shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">
                  Pessoa jurídica
                </p>
                <p className="text-[11px] text-[#6b7280]">
                  Vou me cadastrar com o CNPJ da empresa
                </p>
              </div>
            </button>
          </div>
        )}

        {etapa === "dados" && tipoPessoa === "individual" && (
          <div className="space-y-3">
            {dadosIniciais?.tipoPessoa && (
              <p className="text-[11px] text-[#6b7280] bg-[#fafafa] border border-[#f0f0f1] rounded-lg px-3 py-2">
                Por segurança, CPF e data de nascimento não são devolvidos.
                Preencha esses dois campos novamente para confirmar os dados.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls()}>Nome</label>
                <input
                  className={inputCls()}
                  value={pf.first_name}
                  onChange={(e) => setPf((s) => ({ ...s, first_name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls()}>Sobrenome</label>
                <input
                  className={inputCls()}
                  value={pf.last_name}
                  onChange={(e) => setPf((s) => ({ ...s, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className={labelCls()}>E-mail</label>
              <input
                type="email"
                className={inputCls()}
                value={pf.email}
                onChange={(e) => setPf((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls()}>Telefone</label>
                <input
                  className={inputCls()}
                  placeholder="(00) 00000-0000"
                  value={pf.phone}
                  onChange={(e) => setPf((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls()}>CPF</label>
                <input
                  className={inputCls()}
                  value={pf.cpf}
                  onChange={(e) => setPf((s) => ({ ...s, cpf: formatarCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <div>
              <label className={labelCls()}>Data de nascimento</label>
              <input
                className={inputCls()}
                placeholder="dd/mm/aaaa"
                value={pf.dataNasc}
                onChange={(e) => setPf((s) => ({ ...s, dataNasc: formatarDataNasc(e.target.value) }))}
              />
            </div>
          </div>
        )}

        {etapa === "dados" && tipoPessoa === "company" && (
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-semibold text-[#374151] mb-2">Dados da empresa</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls()}>Razão social</label>
                  <input
                    className={inputCls()}
                    value={pj.name}
                    onChange={(e) => setPj((s) => ({ ...s, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls()}>CNPJ</label>
                    <input
                      className={inputCls()}
                      value={pj.cnpj}
                      onChange={(e) => setPj((s) => ({ ...s, cnpj: formatarCnpj(e.target.value) }))}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div>
                    <label className={labelCls()}>Telefone</label>
                    <input
                      className={inputCls()}
                      value={pj.phone}
                      onChange={(e) => setPj((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#f0f0f1]">
              <p className="text-[12px] font-semibold text-[#374151] mb-2 mt-3">
                Responsável legal
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls()}>Nome</label>
                    <input
                      className={inputCls()}
                      value={rep.first_name}
                      onChange={(e) => setRep((s) => ({ ...s, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls()}>Sobrenome</label>
                    <input
                      className={inputCls()}
                      value={rep.last_name}
                      onChange={(e) => setRep((s) => ({ ...s, last_name: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls()}>E-mail</label>
                  <input
                    type="email"
                    className={inputCls()}
                    value={rep.email}
                    onChange={(e) => setRep((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls()}>Telefone</label>
                    <input
                      className={inputCls()}
                      value={rep.phone}
                      onChange={(e) => setRep((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className={labelCls()}>CPF</label>
                    <input
                      className={inputCls()}
                      value={rep.cpf}
                      onChange={(e) => setRep((s) => ({ ...s, cpf: formatarCpf(e.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls()}>Data de nascimento</label>
                  <input
                    className={inputCls()}
                    placeholder="dd/mm/aaaa"
                    value={rep.dataNasc}
                    onChange={(e) => setRep((s) => ({ ...s, dataNasc: formatarDataNasc(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {etapa === "endereco" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls()}>Endereço</label>
              <input
                className={inputCls()}
                placeholder="Rua, número"
                value={endereco.line1}
                onChange={(e) => setEndereco((s) => ({ ...s, line1: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls()}>Complemento (opcional)</label>
              <input
                className={inputCls()}
                value={endereco.line2}
                onChange={(e) => setEndereco((s) => ({ ...s, line2: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls()}>Cidade</label>
                <input
                  className={inputCls()}
                  value={endereco.city}
                  onChange={(e) => setEndereco((s) => ({ ...s, city: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls()}>Estado</label>
                <select
                  className={inputCls()}
                  value={endereco.state}
                  onChange={(e) => setEndereco((s) => ({ ...s, state: e.target.value }))}
                >
                  {estadosBR.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls()}>CEP</label>
              <input
                className={inputCls()}
                value={endereco.postal_code}
                onChange={(e) => setEndereco((s) => ({ ...s, postal_code: e.target.value }))}
                placeholder="00000-000"
              />
            </div>
          </div>
        )}

        {etapa === "banco" && (
          <div className="space-y-3">
            <div>
              <label className={labelCls()}>Nome do titular da conta</label>
              <input
                className={inputCls()}
                value={banco.account_holder_name}
                onChange={(e) => setBanco((s) => ({ ...s, account_holder_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls()}>Banco</label>
              <select
                className={inputCls()}
                value={banco.codigoBanco}
                onChange={(e) => setBanco((s) => ({ ...s, codigoBanco: e.target.value }))}
              >
                {bancosBR.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.codigo} — {b.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls()}>Agência (sem dígito)</label>
                <input
                  className={inputCls()}
                  value={banco.agencia}
                  onChange={(e) => setBanco((s) => ({ ...s, agencia: e.target.value }))}
                  placeholder="1234"
                />
              </div>
              <div>
                <label className={labelCls()}>Dígito</label>
                <input
                  className={inputCls()}
                  value={banco.digitoAgencia}
                  onChange={(e) => setBanco((s) => ({ ...s, digitoAgencia: e.target.value }))}
                  placeholder="opcional"
                />
              </div>
            </div>
            <div>
              <label className={labelCls()}>Conta (com dígito, sem traço)</label>
              <input
                className={inputCls()}
                value={banco.account_number}
                onChange={(e) => setBanco((s) => ({ ...s, account_number: e.target.value }))}
                placeholder="000000"
              />
            </div>

            {banco.agencia && (
              <p className="text-[11px] text-[#6b7280] bg-[#fafafa] border border-[#f0f0f1] rounded-lg px-3 py-2">
                Será enviado como:{" "}
                <span className="font-mono text-[#374151]">
                  {apenasDigitos(banco.digitoAgencia)
                    ? `${banco.codigoBanco}-${apenasDigitos(banco.agencia).padStart(4, "0")}-${apenasDigitos(banco.digitoAgencia)}`
                    : `${banco.codigoBanco}-${apenasDigitos(banco.agencia).padStart(4, "0")}`}
                </span>
              </p>
            )}
          </div>
        )}

        {etapa === "documento" && (
          <div className="space-y-4">
            <p className="text-[12px] text-[#6b7280]">
              Envie uma foto do seu RG ou CNH para concluirmos a verificação.
            </p>
            <div>
              <label className={labelCls()}>Frente do documento</label>
              <button
                onClick={() => frenteInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-[#d4d4d8] flex flex-col items-center justify-center gap-1 text-[#9ca3af] hover:border-[#16a34a] hover:text-[#16a34a]"
              >
                <Upload size={20} />
                <span className="text-[12px]">
                  {documentoFrente ? documentoFrente.name : "Selecionar arquivo"}
                </span>
              </button>
              <input
                ref={frenteInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setDocumentoFrente(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className={labelCls()}>Verso do documento (se houver)</label>
              <button
                onClick={() => versoInputRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-[#d4d4d8] flex flex-col items-center justify-center gap-1 text-[#9ca3af] hover:border-[#16a34a] hover:text-[#16a34a]"
              >
                <Upload size={20} />
                <span className="text-[12px]">
                  {documentoVerso ? documentoVerso.name : "Selecionar arquivo"}
                </span>
              </button>
              <input
                ref={versoInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setDocumentoVerso(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="button"
              onClick={enviarDocumentoDeTeste}
              disabled={enviandoDoc}
              className="w-full text-[11px] text-[#6b7280] underline disabled:opacity-50"
            >
              Usar documento de teste (apenas sandbox)
            </button>
          </div>
        )}

        {etapa === "concluido" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3">
            <CheckCircle2 size={18} className="text-[#16a34a] shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[#15803d]">
                Cadastro enviado para análise
              </p>
              <p className="text-[11px] text-[#166534]">
                Assim que a verificação for concluída, você poderá receber pagamentos.
              </p>
            </div>
          </div>
        )}

        {erro && (
          <p className="mt-3 text-[12px] text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        {etapa !== "tipo" && etapa !== "concluido" && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                const idx = etapas.indexOf(etapa);
                if (idx > 0) setEtapa(etapas[idx - 1]);
              }}
              className="h-10 px-4 rounded-xl border border-[#e4e4e7] text-[13px] font-medium text-[#374151] flex items-center gap-1"
            >
              <ChevronLeft size={15} /> Voltar
            </button>

            {etapa === "dados" && (
              <button
                onClick={avancarDadosBasicos}
                className="flex-1 h-10 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium flex items-center justify-center gap-1"
              >
                Continuar <ChevronRight size={15} />
              </button>
            )}
            {etapa === "endereco" && (
              <button
                onClick={avancarEndereco}
                disabled={salvando}
                className="flex-1 h-10 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {salvando && <Loader2 size={14} className="animate-spin" />}
                Continuar <ChevronRight size={15} />
              </button>
            )}
            {etapa === "banco" && (
              <button
                onClick={avancarBanco}
                disabled={salvando}
                className="flex-1 h-10 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {salvando && <Loader2 size={14} className="animate-spin" />}
                Continuar <ChevronRight size={15} />
              </button>
            )}
            {etapa === "documento" && (
              <button
                onClick={enviarDocumentos}
                disabled={enviandoDoc}
                className="flex-1 h-10 rounded-xl bg-[#16a34a] text-white text-[13px] font-medium flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {enviandoDoc && <Loader2 size={14} className="animate-spin" />}
                Enviar e concluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
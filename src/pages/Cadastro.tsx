import { FormEvent, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Store,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { traduzirErroAuth, forcaSenha } from "../lib/authErrors";

interface CadastroProps {
  onSuccess?: () => void;
  onVoltarLogin?: () => void;
}

export default function Cadastro({ onSuccess, onVoltarLogin }: CadastroProps) {
  const [nome, setNome] = useState("");
  const [loja, setLoja] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [erro, setErro] = useState("");
  const [confirmacaoEmail, setConfirmacaoEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const forca = forcaSenha(senha);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    if (!nome.trim() || !loja.trim() || !email.trim() || !senha) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // O perfil e a loja são criados por um trigger no banco,
      // que lê "nome" e "loja" daqui. O app não insere em
      // "stores" no cadastro (a sessão ainda não está ativa
      // nesse momento, e a política de segurança bloquearia).
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: { nome: nome.trim(), loja: loja.trim() },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Sem sessão = o projeto exige confirmação por e-mail
      if (!data.session) {
        setConfirmacaoEmail(true);
        return;
      }

      onSuccess?.();
    } catch (err: any) {
      setErro(traduzirErroAuth(err?.message));
    } finally {
      setLoading(false);
    }
  }

  if (confirmacaoEmail) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#f0fdf4] via-[#f9fafb] to-[#f9fafb] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px] bg-white rounded-3xl border border-black/5 shadow-sm p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
            <CheckCircle2 size={26} className="text-[#16a34a]" />
          </div>
          <h1 className="mt-4 text-[19px] font-bold text-[#0f1117]">
            Confirme seu e-mail
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-[#374151]">{email}</span>. Abra o
            link para ativar sua loja.
          </p>
          <button
            onClick={onVoltarLogin}
            className="mt-5 w-full h-13 min-h-[52px] rounded-2xl border border-[#e4e4e7] text-[15px] font-semibold text-[#374151] hover:bg-[#f4f4f5]"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#f0fdf4] via-[#f9fafb] to-[#f9fafb] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[#16a34a] flex items-center justify-center shadow-lg shadow-[#16a34a]/20">
              <Store size={26} className="text-white" strokeWidth={2} />
            </div>
            <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117] tracking-tight">
              Criar sua loja
            </h1>
            <p className="mt-1 text-[13px] text-[#6b7280] text-center">
              Leva menos de um minuto
            </p>
          </div>

          <form
            onSubmit={cadastrar}
            className="bg-white rounded-3xl border border-black/5 shadow-sm p-5 sm:p-6 space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="cad-nome"
                className="block text-[13px] font-medium text-[#374151] mb-1.5"
              >
                Seu nome
              </label>
              <input
                id="cad-nome"
                type="text"
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como você se chama"
                className="w-full h-13 min-h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10"
              />
            </div>

            <div>
              <label
                htmlFor="cad-loja"
                className="block text-[13px] font-medium text-[#374151] mb-1.5"
              >
                Nome da loja
              </label>
              <input
                id="cad-loja"
                type="text"
                autoComplete="organization"
                value={loja}
                onChange={(e) => setLoja(e.target.value)}
                placeholder="Ex: Moda Praia da Ana"
                className="w-full h-13 min-h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10"
              />
              <p className="mt-1.5 text-[12px] text-[#9ca3af]">
                Você pode mudar isso depois.
              </p>
            </div>

            <div>
              <label
                htmlFor="cad-email"
                className="block text-[13px] font-medium text-[#374151] mb-1.5"
              >
                E-mail
              </label>
              <input
                id="cad-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-13 min-h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10"
              />
            </div>

            <div>
              <label
                htmlFor="cad-senha"
                className="block text-[13px] font-medium text-[#374151] mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="cad-senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  aria-describedby="forca-senha"
                  className="w-full h-13 min-h-[52px] pl-4 pr-14 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-[#6b7280] hover:bg-[#f4f4f5]"
                >
                  {mostrarSenha ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              {senha && (
                <div id="forca-senha" className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor:
                            i < forca.nivel ? forca.cor : "#e4e4e7",
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="mt-1 text-[12px] font-medium"
                    style={{ color: forca.cor }}
                  >
                    Senha {forca.texto.toLowerCase()}
                  </p>
                </div>
              )}
            </div>

            {erro && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-[13px] text-[#b91c1c]"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 min-h-[52px] rounded-2xl bg-[#16a34a] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] hover:bg-[#15803d] disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Criando sua loja..." : "Criar loja"}
            </button>

            <p className="text-[11px] leading-relaxed text-[#9ca3af] text-center">
              Ao criar a loja, você concorda com os termos de uso e a política
              de privacidade.
            </p>
          </form>

          <p className="mt-5 text-center text-[13px] text-[#6b7280]">
            Já tem conta?{" "}
            <button
              type="button"
              onClick={onVoltarLogin}
              className="font-semibold text-[#15803d] hover:underline"
            >
              Entrar
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
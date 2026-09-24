import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, Store, AlertCircle, Mail } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { traduzirErroAuth } from "../lib/authErrors";

interface LoginProps {
  onSuccess?: () => void;
  onGoToCadastro?: () => void;
}

export default function Login({ onSuccess, onGoToCadastro }: LoginProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");
    setAviso("");

    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) throw error;
      onSuccess?.();
    } catch (err: any) {
      setErro(traduzirErroAuth(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function recuperarSenha() {
    setErro("");
    setAviso("");

    if (!email.trim()) {
      setErro("Digite seu e-mail para receber o link de recuperação.");
      return;
    }

    setEnviandoReset(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Mensagem igual mesmo se o e-mail não existir: não revela
      // quais endereços têm conta na plataforma.
      setAviso(
        "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha."
      );
    } catch {
      setAviso(
        "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha."
      );
    } finally {
      setEnviandoReset(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#f0fdf4] via-[#f9fafb] to-[#f9fafb] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[400px]">
          {/* Marca */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[#16a34a] flex items-center justify-center shadow-lg shadow-[#16a34a]/20">
              <Store size={26} className="text-white" strokeWidth={2} />
            </div>
            <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117] tracking-tight">
              Entrar na sua loja
            </h1>
            <p className="mt-1 text-[13px] text-[#6b7280] text-center">
              Gerencie produtos, pedidos e pagamentos
            </p>
          </div>

          <form
            onSubmit={entrar}
            className="bg-white rounded-3xl border border-black/5 shadow-sm p-5 sm:p-6 space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="login-email"
                className="block text-[13px] font-medium text-[#374151] mb-1.5"
              >
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                aria-invalid={Boolean(erro)}
                className="w-full h-13 min-h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-senha"
                  className="block text-[13px] font-medium text-[#374151]"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={recuperarSenha}
                  disabled={enviandoReset}
                  className="text-[12px] font-medium text-[#15803d] hover:underline disabled:opacity-60"
                >
                  {enviandoReset ? "Enviando..." : "Esqueci a senha"}
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  aria-invalid={Boolean(erro)}
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

            {aviso && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3 text-[13px] text-[#15803d]"
              >
                <Mail size={16} className="shrink-0 mt-0.5" />
                <span>{aviso}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 min-h-[52px] rounded-2xl bg-[#16a34a] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] hover:bg-[#15803d] disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-[#6b7280]">
            Ainda não tem loja?{" "}
            <button
              type="button"
              onClick={onGoToCadastro}
              className="font-semibold text-[#15803d] hover:underline"
            >
              Criar agora
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
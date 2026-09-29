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
import PainelMarca, { DestaquesMobile } from "../components/PainelMarca";
import BotaoGoogle from "../components/BotaoGoogle";

/**
 * Criar conta.
 *
 * Mesmo desenho do login: duas colunas no computador, formulário
 * primeiro no celular e a faixa de destaques no rodapé.
 *
 * Quem entra pelo Google não passa por aqui. O nome da loja, que este
 * formulário pede, é criado pelo banco a partir do nome da conta do
 * Google — e o lojista renomeia depois em Loja. Pedir o nome da loja
 * ANTES de conhecer a pessoa seria trocar um clique por um formulário,
 * que é exatamente o que o botão do Google existe para evitar.
 */

const campoCls =
  "w-full h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10";

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
      // O perfil e a loja são criados por um gatilho no banco, que lê
      // "nome" e "loja" daqui. O app não insere em "stores" no
      // cadastro: a sessão ainda não está ativa nesse momento e a
      // política de segurança bloquearia.
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
      <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[400px] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
            <CheckCircle2 size={26} className="text-[#16a34a]" />
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117]">
            Confirme seu e-mail
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
            Enviamos um link de confirmação para{" "}
            <span className="font-semibold text-[#374151]">{email}</span>. Abra
            o link para ativar sua loja.
          </p>
          <p className="mt-2 text-[12.5px] text-[#9ca3af]">
            Não chegou? Veja no spam ou na aba de promoções.
          </p>
          <button
            onClick={onVoltarLogin}
            className="mt-6 w-full h-[52px] rounded-2xl border border-[#e4e4e7] text-[15px] font-semibold text-[#374151] hover:bg-[#f4f4f5]"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8 sm:px-8 lg:py-10">
      <div className="w-full max-w-[1180px] grid lg:grid-cols-2 gap-10 items-center">
        <main className="flex items-center justify-center">
          <div className="w-full max-w-[400px]">
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <span className="w-10 h-10 rounded-xl bg-[#16a34a] flex items-center justify-center">
                <Store size={19} className="text-white" strokeWidth={2.2} />
              </span>
              <span className="text-[15px] font-extrabold tracking-tight text-[#0f1117]">
                LojaPro
              </span>
            </div>

            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#0f1117] tracking-tight leading-tight">
              Crie sua loja
            </h1>
            <p className="mt-2 text-[14px] text-[#6b7280] leading-relaxed">
              Leva menos de um minuto. Você já sai vendendo.
            </p>

            {/* O caminho mais curto vem primeiro. Quem tem Google
                resolve num clique e nunca precisa ler o formulário. */}
            <div className="mt-6">
              <BotaoGoogle rotulo="Inscrever-se com o Google" onErro={setErro} />
            </div>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#e7e7ea]" />
              <span className="text-[12.5px] text-[#9ca3af]">
                ou com e-mail
              </span>
              <span className="h-px flex-1 bg-[#e7e7ea]" />
            </div>

            <form onSubmit={cadastrar} className="space-y-4" noValidate>
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
                  placeholder="Como quer ser chamado"
                  className={campoCls}
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
                  value={loja}
                  onChange={(e) => setLoja(e.target.value)}
                  placeholder="Ex: Moda Barreiras"
                  className={campoCls}
                />
                <p className="mt-1 text-[11.5px] text-[#9ca3af]">
                  Dá para mudar depois, em Loja.
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
                  className={campoCls}
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
                    placeholder="Pelo menos 8 caracteres"
                    className={`${campoCls} pr-14`}
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
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(forca.nivel / 3) * 100}%`,
                          backgroundColor: forca.cor,
                        }}
                      />
                    </div>
                    <span
                      className="text-[11.5px] font-medium"
                      style={{ color: forca.cor }}
                    >
                      {forca.texto}
                    </span>
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
                className="w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] hover:bg-[#000] disabled:opacity-60"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? "Criando..." : "Criar minha loja"}
              </button>
            </form>

            <p className="mt-7 text-center text-[13.5px] text-[#6b7280]">
              Já tem conta?{" "}
              <button
                type="button"
                onClick={onVoltarLogin}
                className="font-semibold text-[#15803d] hover:underline"
              >
                Entrar
              </button>
            </p>

            <DestaquesMobile />
          </div>
        </main>

        <PainelMarca />
      </div>
    </div>
  );
}

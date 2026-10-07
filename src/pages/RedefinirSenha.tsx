import { FormEvent, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Clock,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { traduzirErroAuth, forcaSenha } from "../lib/authErrors";
import {
  limparUrl,
  tipoDoLink,
  tokenDoLink,
  trocarTokenPorSessao,
} from "../lib/linkDeEmail";

/**
 * Escolher uma nova senha.
 *
 * É a tela que faltava no fim do "Esqueci a senha". O link do e-mail
 * leva para /redefinir-senha com um token_hash, e a própria tela troca
 * esse token por uma sessão — por isso updateUser já sabe de quem é a
 * senha, sem pedir a antiga.
 *
 * Sem esta tela, o link do e-mail virava um login sem senha: a pessoa
 * caía direto no painel, a senha continuava a mesma e no dia seguinte
 * ela não entrava de novo.
 *
 * No fim ela DESCONECTA e manda para o login. O link de recuperação
 * cria uma sessão que ninguém digitou senha para obter — deixar o
 * painel aberto em cima dela seria entrar sem senha. Digitar a senha
 * nova no login também prova, ali na hora, que a troca funcionou.
 *
 * "Cancelar" desconecta pelo mesmo motivo: quem chegou por link de
 * e-mail e desistiu não pode ficar dentro do painel.
 */

const campoCls =
  "w-full h-[52px] px-4 rounded-2xl border border-[#e4e4e7] bg-white text-[16px] outline-none transition focus:border-[#16a34a] focus:ring-4 focus:ring-[#16a34a]/10";

interface RedefinirSenhaProps {
  /** Falso quando o link já foi usado, expirou ou veio adulterado. */
  temSessao: boolean;
  onConcluido: () => void;
  onVoltarLogin: () => void;
}

export default function RedefinirSenha({
  temSessao,
  onConcluido,
  onVoltarLogin,
}: RedefinirSenhaProps) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Só há o que verificar se o link trouxe token. Sem token, quem
  // manda é a sessão que o App já resolveu.
  const [verificando, setVerificando] = useState(() =>
    Boolean(tokenDoLink(window.location.search))
  );
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    const token = tokenDoLink(window.location.search);
    if (!token) return;

    const tipo = tipoDoLink(window.location.search, ["recovery"]);
    let vivo = true;

    (async () => {
      const r = tipo
        ? await trocarTokenPorSessao(token, tipo)
        : { autenticado: false, faltaOutroLado: false, invalido: true };

      limparUrl();
      if (!vivo) return;
      setVerificado(r.autenticado);
      setVerificando(false);
    })();

    return () => {
      vivo = false;
    };
  }, []);

  // temSessao cobre o caminho antigo (link que já chega autenticado);
  // verificado cobre o link novo, que chega com token e sem sessão.
  const liberado = verificado || temSessao;

  const forca = forcaSenha(senha);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro("");

    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As duas senhas não são iguais.");
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;

      // Some da memória do navegador assim que não é mais necessária.
      setSenha("");
      setConfirmacao("");
      setPronto(true);

      // Encerra a sessão que veio do link. A partir daqui só se entra
      // digitando a senha nova.
      await supabase.auth.signOut();
    } catch (err: any) {
      setErro(traduzirErroAuth(err?.message));
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------------------
  // Trocou — já desconectado
  // ------------------------------------------------------------
  if (pronto) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[400px] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
            <CheckCircle2 size={26} className="text-[#16a34a]" />
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117]">
            Senha alterada
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
            Pronto. Agora entre com a senha nova.
          </p>
          <button
            onClick={onConcluido}
            className="mt-6 w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold hover:bg-[#000]"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Validando o link
  // ------------------------------------------------------------
  if (verificando) {
    return (
      <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-8 gap-3">
        <Loader2 size={24} className="animate-spin text-[#16a34a]" />
        <p className="text-[14px] text-[#6b7280]">Validando seu link…</p>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Link morto
  // ------------------------------------------------------------
  if (!liberado) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[400px] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#fef2f2] flex items-center justify-center">
            <Clock size={24} className="text-[#dc2626]" />
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117]">
            Este link não vale mais
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
            Links de redefinição valem por 1 hora e só funcionam uma vez. Peça
            um novo na tela de login, em "Esqueci a senha".
          </p>
          <button
            onClick={onVoltarLogin}
            className="mt-6 w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold hover:bg-[#000]"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Formulário
  // ------------------------------------------------------------
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-[400px]">
        <div className="w-12 h-12 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
          <KeyRound size={22} className="text-[#16a34a]" />
        </div>

        <h1 className="mt-4 text-[26px] sm:text-[28px] font-extrabold text-[#0f1117] tracking-tight leading-tight">
          Criar nova senha
        </h1>
        <p className="mt-2 text-[14px] text-[#6b7280] leading-relaxed">
          Escolha uma senha que você não use em outro site.
        </p>

        <form onSubmit={salvar} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="nova-senha"
              className="block text-[13px] font-medium text-[#374151] mb-1.5"
            >
              Nova senha
            </label>
            <div className="relative">
              <input
                id="nova-senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 8 caracteres"
                aria-invalid={Boolean(erro)}
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
                <div className="h-1 flex-1 rounded-full bg-[#f4f4f5] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((forca.nivel + 1) / 4) * 100}%`,
                      background: forca.cor,
                    }}
                  />
                </div>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: forca.cor }}
                >
                  {forca.texto}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmar-senha"
              className="block text-[13px] font-medium text-[#374151] mb-1.5"
            >
              Repita a nova senha
            </label>
            <input
              id="confirmar-senha"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Digite de novo"
              aria-invalid={Boolean(erro)}
              className={campoCls}
            />
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
            disabled={salvando}
            className="w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99] hover:bg-[#000] disabled:opacity-60"
          >
            {salvando && <Loader2 size={18} className="animate-spin" />}
            {salvando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <button
          type="button"
          onClick={onVoltarLogin}
          className="mt-4 w-full h-[48px] rounded-2xl text-[14px] font-semibold text-[#6b7280] hover:bg-[#f4f4f5]"
        >
          Cancelar e voltar para o login
        </button>
      </div>
    </div>
  );
}

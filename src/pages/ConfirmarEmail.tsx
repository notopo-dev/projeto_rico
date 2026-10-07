import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, MailCheck } from "lucide-react";
import {
  limparUrl,
  tipoDoLink,
  tokenDoLink,
  trocarTokenPorSessao,
} from "../lib/linkDeEmail";

/**
 * Fim do link de "Confirme seu e-mail".
 *
 * Atende os dois e-mails que confirmam endereço: o do cadastro novo
 * (type=signup) e o da troca de e-mail (type=email_change). São a
 * mesma mecânica — trocar o token por sessão — e separar em duas telas
 * só duplicaria o mesmo código.
 *
 * Esta tela existe para o link do e-mail apontar para
 * moneynotopo.com.br. Antes ele era um endereço supabase.co, que
 * aparecia inteiro no corpo da mensagem.
 */

type Estado = "verificando" | "pronto" | "faltaOutroLado" | "invalido";

interface ConfirmarEmailProps {
  onIrParaPainel: () => void;
  onIrParaLogin: () => void;
}

export default function ConfirmarEmail({
  onIrParaPainel,
  onIrParaLogin,
}: ConfirmarEmailProps) {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [tipo, setTipo] = useState<"signup" | "email_change">("signup");

  useEffect(() => {
    const token = tokenDoLink(window.location.search);
    const t = tipoDoLink(window.location.search, ["signup", "email_change"]);
    let vivo = true;

    (async () => {
      if (!token || !t) {
        limparUrl();
        if (vivo) setEstado("invalido");
        return;
      }

      if (vivo) setTipo(t);
      const r = await trocarTokenPorSessao(token, t);
      limparUrl();
      if (!vivo) return;

      if (r.autenticado) setEstado("pronto");
      else if (r.faltaOutroLado) setEstado("faltaOutroLado");
      else setEstado("invalido");
    })();

    return () => {
      vivo = false;
    };
  }, []);

  if (estado === "verificando") {
    return (
      <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-8 gap-3">
        <Loader2 size={24} className="animate-spin text-[#16a34a]" />
        <p className="text-[14px] text-[#6b7280]">Confirmando seu e-mail…</p>
      </div>
    );
  }

  if (estado === "invalido") {
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
            Links de confirmação valem por 24 horas e só funcionam uma vez. Se
            o seu e-mail já foi confirmado antes, é só entrar normalmente.
          </p>
          <button
            onClick={onIrParaLogin}
            className="mt-6 w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold hover:bg-[#000]"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  // O Supabase aceitou, mas pede confirmação nos dois endereços.
  if (estado === "faltaOutroLado") {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-[400px] text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
            <MailCheck size={26} className="text-[#16a34a]" />
          </div>
          <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117]">
            Confirmado por aqui
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
            Falta confirmar no outro endereço. Enviamos o mesmo link para o
            e-mail antigo — abra ele também para concluir a troca.
          </p>
          <button
            onClick={onIrParaLogin}
            className="mt-6 w-full h-[52px] rounded-2xl border border-[#e4e4e7] text-[15px] font-semibold text-[#374151] hover:bg-[#f4f4f5]"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-[400px] text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#f0fdf4] flex items-center justify-center">
          <CheckCircle2 size={26} className="text-[#16a34a]" />
        </div>
        <h1 className="mt-4 text-[22px] font-extrabold text-[#0f1117]">
          E-mail confirmado
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
          {tipo === "signup"
            ? "Sua loja está liberada. Bem-vindo à Money NoTopo!"
            : "Pronto. A partir de agora você entra com o novo endereço."}
        </p>
        <button
          onClick={onIrParaPainel}
          className="mt-6 w-full h-[52px] rounded-2xl bg-[#0f1117] text-white text-[15px] font-semibold hover:bg-[#000]"
        >
          Ir para o painel
        </button>
      </div>
    </div>
  );
}

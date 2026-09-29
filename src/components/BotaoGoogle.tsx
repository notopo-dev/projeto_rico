import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/**
 * Entrar ou criar conta com o Google.
 *
 * Um botão só para as duas coisas, de propósito: quem clica não sabe
 * (nem precisa saber) se já tem conta. O Supabase cria a conta se não
 * existir e entra se existir. Ter dois botões diferentes para o mesmo
 * clique só gera a dúvida "será que eu já tinha?".
 *
 * Sobre a marca: o "G" colorido é marca registrada do Google e tem
 * regras próprias de uso. Desenhar uma imitação em SVG é o que elas
 * não permitem, então o botão é limpo e escrito. Para usar a marca
 * oficial, baixe o arquivo que o Google distribui e troque aqui.
 */

interface Props {
  /** Texto do botão. "Entrar" na tela de login, "Criar conta" no cadastro. */
  rotulo?: string;
  onErro: (mensagem: string) => void;
}

export default function BotaoGoogle({
  rotulo = "Continuar com Google",
  onErro,
}: Props) {
  const [indo, setIndo] = useState(false);

  async function entrar() {
    setIndo(true);
    onErro("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Para onde o Google devolve a pessoa depois de autorizar.
          // Sai do servidor do navegador atual, nunca de parâmetro da
          // URL — senão daria para montar um link que desvia o retorno.
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            // Garante que a conta apareça para escolher, em vez de
            // entrar direto na última usada no aparelho. Importante em
            // computador compartilhado.
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      // Não desliga o "indo": a página está saindo para o Google.
    } catch (err: any) {
      setIndo(false);
      onErro(
        err?.message?.includes("provider is not enabled")
          ? "O login com Google ainda não está ativado nesta loja."
          : "Não foi possível abrir o login do Google. Tente de novo.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={indo}
      className="w-full h-[52px] rounded-2xl border border-[#e4e4e7] bg-white text-[15px] font-semibold text-[#374151] flex items-center justify-center gap-2.5 transition hover:bg-[#fafafa] active:scale-[0.99] disabled:opacity-60"
    >
      {indo ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <span
          aria-hidden="true"
          className="w-5 h-5 rounded-full border-[2.5px] border-[#9ca3af] border-r-transparent rotate-45"
        />
      )}
      {indo ? "Abrindo o Google..." : rotulo}
    </button>
  );
}

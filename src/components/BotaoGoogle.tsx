import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Entrar ou criar conta com o Google.
 *
 * Um botão só para as duas coisas, de propósito: quem clica não sabe
 * (nem precisa saber) se já tem conta. O Supabase cria se não existir
 * e entra se existir. Dois botões diferentes para o mesmo clique só
 * geram a dúvida "será que eu já tinha?".
 *
 * A marca e o CSS são os OFICIAIS do Google, distribuídos por eles na
 * página de diretrizes. Não são decoração nossa: o logotipo, a cor da
 * borda, o raio de 4px e o espaçamento ao redor do ícone são
 * exigências de uso da marca. Por isso este botão não segue o
 * arredondamento dos outros da tela — e não deve seguir.
 *
 * O CSS mora em index.css, sob as classes .gsi-material-button.
 */

interface Props {
  /** Texto do botão. O Google exige uma das variações aprovadas. */
  rotulo?: string;
  onErro: (mensagem: string) => void;
}

export default function BotaoGoogle({
  rotulo = "Fazer login com o Google",
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
          // Montado a partir da origem atual, nunca de parâmetro da
          // URL — senão daria para forjar um link que desvia o retorno.
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            // Mostra a lista de contas em vez de entrar direto na
            // última usada no aparelho. Importa em computador
            // compartilhado.
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
          ? "O login com Google ainda não foi ativado. Se você é o dono da plataforma, ative em Authentication → Providers no Supabase."
          : "Não foi possível abrir o login do Google. Tente de novo.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={indo}
      className="gsi-material-button"
    >
      <div className="gsi-material-button-state" />
      <div className="gsi-material-button-content-wrapper">
        <div className="gsi-material-button-icon">
          {/* Logotipo oficial do Google, exatamente como eles
              distribuem. Não editar as cores nem as formas. */}
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            width="20"
            height="20"
            style={{ display: "block" }}
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
        </div>
        <span className="gsi-material-button-contents">
          {indo ? "Abrindo o Google..." : rotulo}
        </span>
      </div>
    </button>
  );
}

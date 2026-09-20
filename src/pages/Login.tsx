import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

interface LoginProps {
  onSuccess?: () => void;
  onGoToCadastro?: () => void;
}

export default function Login({ onSuccess, onGoToCadastro }: LoginProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setLoading(true);
    setErro("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        throw error;
      }

      onSuccess?.();
    } catch (err: any) {
      setErro(err.message || "Erro ao entrar");
    }

    setLoading(false);
  }

  return (
    <div
      className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-[#f9fafb]
        p-4
      "
    >
      <div
        className="
          w-full
          max-w-md
          bg-white
          rounded-2xl
          border
          border-[#e5e7eb]
          shadow-sm
          p-6
        "
      >
        <div className="mb-6">
          <h1
            className="
              text-2xl
              font-bold
              text-[#111827]
            "
          >
            Entrar
          </h1>

          <p
            className="
              text-sm
              text-[#6b7280]
              mt-1
            "
          >
            Acesse o painel da sua loja
          </p>
        </div>

        <form className="space-y-4" onSubmit={entrar}>
          <div>
            <label
              className="
                block
                text-sm
                font-medium
                text-[#374151]
                mb-1
              "
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="
                w-full
                h-11
                px-3
                rounded-xl
                border
                border-[#d1d5db]
                outline-none
                focus:ring-2
                focus:ring-[#16a34a]
              "
            />
          </div>

          <div>
            <label
              className="
                block
                text-sm
                font-medium
                text-[#374151]
                mb-1
              "
            >
              Senha
            </label>

            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="********"
              className="
                w-full
                h-11
                px-3
                rounded-xl
                border
                border-[#d1d5db]
                outline-none
                focus:ring-2
                focus:ring-[#16a34a]
              "
            />
          </div>

          {erro && (
            <div
              className="
                bg-red-50
                border
                border-red-200
                text-red-600
                text-sm
                rounded-xl
                p-3
              "
            >
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              h-11
              bg-[#16a34a]
              hover:bg-[#15803d]
              text-white
              rounded-xl
              font-semibold
              transition
              disabled:opacity-50
            "
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={onGoToCadastro}
            className="w-full text-sm font-medium text-[#15803d] hover:underline"
          >
            Ainda não tenho uma conta
          </button>
        </form>
      </div>
    </div>
  );
}
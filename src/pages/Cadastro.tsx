import { useState } from "react";
import { supabase } from "../lib/supabase";

interface CadastroProps {
  onSuccess?: () => void;
  onVoltarLogin?: () => void;
}

export default function Cadastro({ onSuccess, onVoltarLogin }: CadastroProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loja, setLoja] = useState("");

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function cadastrar() {
    setErro("");

    if (!nome.trim() || !email.trim() || !senha.trim() || !loja.trim()) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      // Cria usuário no Supabase Auth.
      // O "nome" vai em options.data para o trigger do banco
      // (handle_new_user) criar o profile automaticamente —
      // não fazemos mais o insert manual em "profiles" aqui.
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome },
        },
      });

      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error("Usuário não criado");

      // Cria a loja do usuário
      const slug = loja
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const { error: lojaError } = await supabase.from("stores").insert({
        owner_id: user.id,
        nome: loja,
        slug: slug,
        email: email,
      });

      if (lojaError) {
        // Mensagem mais clara para o erro mais comum: slug repetido
        if (lojaError.code === "23505") {
          throw new Error(
            "Já existe uma loja com esse nome. Escolha outro nome de loja."
          );
        }
        throw lojaError;
      }

      onSuccess?.();
    } catch (err: any) {
      setErro(err.message || "Erro ao criar conta");
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
          bg-white
          w-full
          max-w-md
          rounded-2xl
          border
          border-[#e5e7eb]
          shadow-sm
          p-6
        "
      >
        <h1
          className="
            text-2xl
            font-bold
            text-[#111827]
            mb-1
          "
        >
          Criar sua loja
        </h1>

        <p
          className="
            text-sm
            text-gray-500
            mb-6
          "
        >
          Comece sua loja online
        </p>

        <input
          className="
            w-full
            h-11
            border
            rounded-xl
            px-3
            mb-3
          "
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <input
          className="
            w-full
            h-11
            border
            rounded-xl
            px-3
            mb-3
          "
          placeholder="Nome da loja"
          value={loja}
          onChange={(e) => setLoja(e.target.value)}
        />

        <input
          className="
            w-full
            h-11
            border
            rounded-xl
            px-3
            mb-3
          "
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="
            w-full
            h-11
            border
            rounded-xl
            px-3
            mb-4
          "
          placeholder="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && (
          <div
            className="
              bg-red-50
              text-red-600
              border
              border-red-200
              rounded-xl
              p-3
              text-sm
              mb-4
            "
          >
            {erro}
          </div>
        )}

        <button
          onClick={cadastrar}
          disabled={loading}
          className="
            w-full
            h-11
            bg-[#16a34a]
            hover:bg-[#15803d]
            text-white
            rounded-xl
            font-semibold
            disabled:opacity-50
          "
        >
          {loading ? "Criando loja..." : "Criar loja"}
        </button>

        <button
          type="button"
          onClick={onVoltarLogin}
          className="w-full text-sm font-medium text-[#15803d] hover:underline mt-4"
        >
          Já tenho uma conta
        </button>
      </div>
    </div>
  );
}
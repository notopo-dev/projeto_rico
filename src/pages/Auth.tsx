import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Login from "./Login";
import Cadastro from "./Cadastro";

interface AuthProps {
  onSuccess: () => void;
}

/**
 * Controla a alternância entre a tela de Login e a de Cadastro.
 * Use este componente no lugar de renderizar <Login /> direto no
 * App — ele decide qual das duas telas mostrar.
 */
export default function Auth({ onSuccess }: AuthProps) {
  const [tela, setTela] = useState<"login" | "cadastro">("login");

  if (tela === "cadastro") {
    return (
      <Cadastro onSuccess={onSuccess} onVoltarLogin={() => setTela("login")} />
    );
  }

  return (
    <Login onSuccess={onSuccess} onGoToCadastro={() => setTela("cadastro")} />
  );
}

/**
 * Hook simples para saber se o usuário está logado.
 * Use no App.tsx para decidir entre mostrar <Auth /> ou o painel.
 */
export function useSession() {
  const [session, setSession] = useState<any>(undefined); // undefined = ainda carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return session;
}
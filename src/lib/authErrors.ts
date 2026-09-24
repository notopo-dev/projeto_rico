/**
 * Traduz os erros do Supabase Auth para mensagens em português.
 *
 * Importante para segurança: no login, erros de "e-mail não
 * existe" e "senha errada" recebem a MESMA mensagem. Diferenciar
 * os dois permitiria descobrir quais e-mails têm conta na
 * plataforma (enumeração de usuários).
 */
export function traduzirErroAuth(mensagem: string): string {
  const m = (mensagem ?? "").toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (m.includes("password should be at least")) {
    return "A senha é muito curta.";
  }
  if (m.includes("weak password") || m.includes("pwned")) {
    return "Essa senha é muito comum ou apareceu em vazamentos. Escolha outra.";
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("for security purposes")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "E-mail inválido.";
  }
  if (m.includes("database error")) {
    return "Não foi possível concluir o cadastro agora. Tente novamente em instantes.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Sem conexão com o servidor. Verifique sua internet.";
  }

  return mensagem || "Não foi possível concluir. Tente novamente.";
}

/**
 * Força da senha, só para orientar o usuário na tela.
 * A validação que vale é a do servidor (Supabase).
 */
export function forcaSenha(senha: string): {
  nivel: 0 | 1 | 2 | 3;
  texto: string;
  cor: string;
} {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (senha.length >= 12) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^a-zA-Z0-9]/.test(senha)) pontos++;

  if (senha.length < 8) return { nivel: 0, texto: "Muito curta", cor: "#dc2626" };
  if (pontos <= 2) return { nivel: 1, texto: "Fraca", cor: "#ea580c" };
  if (pontos <= 3) return { nivel: 2, texto: "Boa", cor: "#ca8a04" };
  return { nivel: 3, texto: "Forte", cor: "#16a34a" };
}
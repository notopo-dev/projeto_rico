import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RedefinirSenha from "./pages/RedefinirSenha";
import Dashboard from "./pages/Dashboard";
import Loja from "./pages/Loja";
import Products from "./pages/Products";
import Categorias from "./pages/Categorias";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Estoque from "./pages/Estoque";
import Frete from "./pages/Frete";
import Vendas from "./pages/Vendas";
import Pagamentos from "./pages/Pagamentos";
import Recebimentos from "./pages/Recebimentos";
import WhatsApp from "./pages/WhatsApp";
import Configuracoes from "./pages/Configuracoes";
import Academy from "./pages/Academy";
import Header from "./components/Header";
import Sidebar, { Page } from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import { TelaCarregando } from "./components/Carregando";

const pageConfig: Record<Page, { title: string; component: ReactNode }> = {
  dashboard: { title: "Visão geral", component: <Dashboard /> },
  loja: { title: "Loja", component: <Loja /> },
  produtos: { title: "Produtos", component: <Products /> },
  categorias: { title: "Categorias", component: <Categorias /> },
  pedidos: { title: "Pedidos", component: <Orders /> },
  clientes: { title: "Clientes", component: <Customers /> },
  estoque: { title: "Estoque", component: <Estoque /> },
  frete: { title: "Frete", component: <Frete /> },
  vendas: { title: "Vendas", component: <Vendas /> },
  pagamentos: { title: "Pagamentos", component: <Pagamentos /> },
  recebimentos: { title: "Recebimentos", component: <Recebimentos /> },
  whatsapp: { title: "WhatsApp", component: <WhatsApp /> },
  academy: { title: "Academy", component: <Academy /> },
  configuracoes: { title: "Configurações", component: <Configuracoes /> },
};

/** Guarda a última tela aberta, para o F5 não jogar o lojista no início. */
const CHAVE_ULTIMA_PAGINA = "lojapro:ultima-pagina";

function ehPaginaValida(v: string): v is Page {
  return v in pageConfig;
}

/**
 * Qual página abrir.
 *
 * Ordem de prioridade:
 *   1. A URL — é o que o F5, o histórico e um link compartilhado dizem
 *   2. A última visitada nesta máquina — cobre o caso de cair em "/"
 *      depois do login
 *   3. Visão geral
 */
function paginaInicial(): Page {
  const daUrl = window.location.pathname.replace(/^\//, "");
  if (ehPaginaValida(daUrl)) return daUrl;

  try {
    const salva = localStorage.getItem(CHAVE_ULTIMA_PAGINA);
    if (salva && ehPaginaValida(salva)) return salva;
  } catch {
    // navegador com armazenamento bloqueado: segue no padrão
  }

  return "dashboard";
}

export default function App() {
  const [session, setSession] = useState<any>(undefined);
  const [currentPage, setCurrentPage] = useState<Page>(paginaInicial);
  const [authPath, setAuthPath] = useState<"login" | "cadastro">(
    window.location.pathname === "/cadastro" ? "cadastro" : "login"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * O link de "Esqueci a senha" cria uma sessão de verdade antes de
   * qualquer senha nova existir. Sem este desvio o app via a sessão,
   * abria o painel e a senha continuava a antiga — o link de
   * recuperação virava um login sem senha.
   */
  const [recuperandoSenha, setRecuperandoSenha] = useState(
    window.location.pathname === "/redefinir-senha"
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      // Rede de segurança: se o endereço /redefinir-senha não estiver
      // na lista de permitidos do Supabase, o link cai em "/" e o
      // caminho sozinho não denunciaria a recuperação. Este evento sim.
      if (event === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
      setSession(nextSession);
    });

    const onPopState = () => {
      setCurrentPage(paginaInicial());
      setAuthPath(window.location.pathname === "/cadastro" ? "cadastro" : "login");
      setRecuperandoSenha(window.location.pathname === "/redefinir-senha");
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  /**
   * Mantém a URL igual à página aberta.
   *
   * Sem isto, entrar logado em "/" mostrava a última página salva mas a
   * URL continuava "/", e o F5 seguinte caía na visão geral.
   */
  useEffect(() => {
    if (!session) return;
    // Durante a troca de senha a URL fica onde está: assim um F5 no
    // meio do caminho volta para a tela de senha, e não para o painel.
    if (recuperandoSenha) return;

    const esperado = `/${currentPage}`;
    if (window.location.pathname !== esperado) {
      window.history.replaceState({}, "", esperado);
    }

    try {
      localStorage.setItem(CHAVE_ULTIMA_PAGINA, currentPage);
    } catch {
      // sem armazenamento: a URL já garante o F5
    }
  }, [currentPage, session, recuperandoSenha]);

  function goTo(page: Page) {
    window.history.pushState({}, "", `/${page}`);
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  // Navegação entre /login e /cadastro (só usada quando deslogado)
  function goToAuth(path: "login" | "cadastro") {
    window.history.pushState({}, "", `/${path}`);
    setAuthPath(path);
  }

  async function logout() {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem(CHAVE_ULTIMA_PAGINA);
    } catch {
      // nada a fazer
    }
    window.history.replaceState({}, "", "/login");
    setAuthPath("login");
    setCurrentPage("dashboard");
  }

  if (session === undefined) {
    return <TelaCarregando texto="Carregando sua loja…" />;
  }

  if (recuperandoSenha) {
    return (
      <RedefinirSenha
        temSessao={Boolean(session)}
        onConcluido={() => {
          setRecuperandoSenha(false);
          goTo("dashboard");
        }}
        onVoltarLogin={async () => {
          // Desconecta de propósito: quem chegou por link de e-mail e
          // não trocou a senha não pode continuar dentro do painel.
          await supabase.auth.signOut();
          setRecuperandoSenha(false);
          window.history.replaceState({}, "", "/login");
          setAuthPath("login");
        }}
      />
    );
  }

  if (!session) {
    if (authPath === "cadastro") {
      return (
        <Cadastro
          onSuccess={() => goTo(paginaInicial())}
          onVoltarLogin={() => goToAuth("login")}
        />
      );
    }

    if (window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
    }

    return (
      <Login
        onSuccess={() => goTo(paginaInicial())}
        onGoToCadastro={() => goToAuth("cadastro")}
      />
    );
  }

  const page = pageConfig[currentPage];

  return (
    <div className="flex min-h-dvh bg-[var(--app-fundo)] text-[var(--app-texto)]">
      <Sidebar
        current={currentPage}
        onNavigate={goTo}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header
          title={page.title}
          onMenuToggle={() => setMobileMenuOpen(true)}
          onLogout={logout}
        />
        {/* Sem overflow aqui de propósito: quem rola é a JANELA.
            Enquanto a rolagem acontecia dentro desta div, componentes
            de terceiros que abrem menus (o formulário de verificação
            da Stripe) calculavam a posição errada — a lista abria por
            cima do cabeçalho, cortada, sem como rolar até ela. */}
        <div className="flex-1 com-barra-inferior">
          {/* key: remonta ao trocar de página, o que dispara a animação
              de entrada e zera o estado da tela anterior.
              anim-aparecer (e não anim-surgir): esta animação não usa
              transform. Um transform aqui viraria bloco de contenção e
              quebraria o position:fixed de qualquer embed lá dentro. */}
          <div key={currentPage} className="anim-aparecer">
            {page.component}
          </div>
        </div>
      </main>

      <BottomNav current={currentPage} onNavigate={goTo} />
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Dashboard from "./pages/Dashboard";
import Loja from "./pages/Loja";
import Products from "./pages/Products";
import Categorias from "./pages/Categorias";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Estoque from "./pages/Estoque";
import Vendas from "./pages/Vendas";
import Pagamentos from "./pages/Pagamentos";
import WhatsApp from "./pages/WhatsApp";
import Configuracoes from "./pages/Configuracoes";
import Header from "./components/Header";
import Sidebar, { Page } from "./components/Sidebar";

const pageConfig: Record<Page, { title: string; component: ReactNode }> = {
  dashboard: { title: "Visão geral", component: <Dashboard /> },
  loja: { title: "Loja", component: <Loja /> },
  produtos: { title: "Produtos", component: <Products /> },
  categorias: { title: "Categorias", component: <Categorias /> },
  pedidos: { title: "Pedidos", component: <Orders /> },
  clientes: { title: "Clientes", component: <Customers /> },
  estoque: { title: "Estoque", component: <Estoque /> },
  vendas: { title: "Vendas", component: <Vendas /> },
  pagamentos: { title: "Pagamentos", component: <Pagamentos /> },
  whatsapp: { title: "WhatsApp", component: <WhatsApp /> },
  configuracoes: { title: "Configurações", component: <Configuracoes /> },
};

function getPageFromUrl(): Page {
  const value = window.location.pathname.replace(/^\//, "") as Page;
  return value in pageConfig ? value : "dashboard";
}

export default function App() {
  const [session, setSession] = useState<any>(undefined);
  const [currentPage, setCurrentPage] = useState<Page>(getPageFromUrl);
  const [authPath, setAuthPath] = useState<"login" | "cadastro">(
    window.location.pathname === "/cadastro" ? "cadastro" : "login"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    const onPopState = () => {
      setCurrentPage(getPageFromUrl());
      setAuthPath(window.location.pathname === "/cadastro" ? "cadastro" : "login");
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  function goTo(page: Page) {
    window.history.pushState({}, "", `/${page}`);
    setCurrentPage(page);
    setMobileMenuOpen(false);
  }

  // Navegação entre /login e /cadastro (só usada quando deslogado)
  function goToAuth(path: "login" | "cadastro") {
    window.history.pushState({}, "", `/${path}`);
    setAuthPath(path);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.history.replaceState({}, "", "/login");
    setAuthPath("login");
    setCurrentPage("dashboard");
  }

  if (session === undefined) {
    return <div className="min-h-screen bg-[#f9fafb]" />;
  }

  if (!session) {
    if (authPath === "cadastro") {
      return (
        <Cadastro
          onSuccess={() => goTo("dashboard")}
          onVoltarLogin={() => goToAuth("login")}
        />
      );
    }

    if (window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
    }

    return (
      <Login
        onSuccess={() => goTo("dashboard")}
        onGoToCadastro={() => goToAuth("cadastro")}
      />
    );
  }

  const page = pageConfig[currentPage];

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-[#0f1117]">
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
        <div className="min-h-0 flex-1 overflow-auto">{page.component}</div>
      </main>
    </div>
  );
}
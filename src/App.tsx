import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RedefinirSenha from "./pages/RedefinirSenha";
import ConfirmarEmail from "./pages/ConfirmarEmail";
import Apresentacao from "./pages/Apresentacao";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import Dashboard from "./pages/Dashboard";
import Loja from "./pages/Loja";
import Products from "./pages/Products";
import Categorias from "./pages/Categorias";
import Cupons from "./pages/Cupons";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Estoque from "./pages/Estoque";
import Frete from "./pages/Frete";
import Vendas from "./pages/Vendas";
import Pagamentos from "./pages/Pagamentos";
import Recebimentos from "./pages/Recebimentos";
import Assinatura from "./pages/Assinatura";
import WhatsApp from "./pages/WhatsApp";
import Configuracoes from "./pages/Configuracoes";
import Academy from "./pages/Academy";
import Header from "./components/Header";
import Sidebar, { Page } from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import AvisoDeTeste from "./components/AvisoDeTeste";
import { lerAssinatura } from "./lib/assinaturaApi";
import { TelaCarregando } from "./components/Carregando";

const pageConfig: Record<Page, { title: string; component: ReactNode }> = {
  dashboard: { title: "Visão geral", component: <Dashboard /> },
  loja: { title: "Loja", component: <Loja /> },
  produtos: { title: "Produtos", component: <Products /> },
  categorias: { title: "Categorias", component: <Categorias /> },
  cupons: { title: "Cupons", component: <Cupons /> },
  pedidos: { title: "Pedidos", component: <Orders /> },
  clientes: { title: "Clientes", component: <Customers /> },
  estoque: { title: "Estoque", component: <Estoque /> },
  frete: { title: "Frete", component: <Frete /> },
  vendas: { title: "Vendas", component: <Vendas /> },
  pagamentos: { title: "Pagamentos", component: <Pagamentos /> },
  recebimentos: { title: "Recebimentos", component: <Recebimentos /> },
  assinatura: { title: "Assinatura", component: <Assinatura /> },
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
 * As telas que existem antes de o lojista ter conta.
 *
 * "site" é a apresentação: a raiz passou a ser a página de vendas,
 * e não mais um desvio para o login.
 */
type CaminhoPublico = "site" | "login" | "cadastro" | "termos" | "privacidade";

function caminhoPublico(pathname: string): CaminhoPublico {
  switch (pathname) {
    case "/cadastro":
      return "cadastro";
    case "/login":
      return "login";
    case "/termos":
      return "termos";
    case "/privacidade":
      return "privacidade";
    case "/":
      return "site";
    default:
      // Endereço desconhecido e sem conta: a apresentação explica o
      // que é isto aqui melhor do que um formulário de senha.
      return "site";
  }
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
  /**
   * Onde o visitante sem conta está.
   *
   * Antes isto era só login|cadastro, e QUALQUER outro endereço era
   * reescrito para /login. Era por isso que /termos e /privacidade
   * caíam na tela de entrar — as duas páginas existiam, escritas e
   * completas, e não estavam registradas em lugar nenhum. A Stripe
   * exige essas URLs funcionando para revisar a integração.
   */
  const [authPath, setAuthPath] = useState<CaminhoPublico>(() =>
    caminhoPublico(window.location.pathname)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Loja sem assinatura válida: o painel fecha e sobra só a tela de
   * cobrança.
   *
   * `null` = ainda não sabemos. `false` em caso de ERRO é
   * proposital: uma falha de rede não pode trancar o lojista para
   * fora do próprio painel. Isto aqui é desenho de tela, não
   * segurança — quem recusa pedido de loja sem assinatura é o
   * gatilho no banco, e ele não depende desta variável.
   */
  const [bloqueada, setBloqueada] = useState<boolean | null>(null);

  /**
   * O link de "Esqueci a senha" cria uma sessão de verdade antes de
   * qualquer senha nova existir. Sem este desvio o app via a sessão,
   * abria o painel e a senha continuava a antiga — o link de
   * recuperação virava um login sem senha.
   */
  const [recuperandoSenha, setRecuperandoSenha] = useState(
    window.location.pathname === "/redefinir-senha"
  );

  /** Fim dos links de confirmar cadastro e de trocar o e-mail. */
  const [confirmandoEmail, setConfirmandoEmail] = useState(
    window.location.pathname === "/confirmar-email"
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
      setAuthPath(caminhoPublico(window.location.pathname));
      setRecuperandoSenha(window.location.pathname === "/redefinir-senha");
      setConfirmandoEmail(window.location.pathname === "/confirmar-email");
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
    if (recuperandoSenha || confirmandoEmail) return;

    const esperado = `/${currentPage}`;
    if (window.location.pathname !== esperado) {
      window.history.replaceState({}, "", esperado);
    }

    try {
      localStorage.setItem(CHAVE_ULTIMA_PAGINA, currentPage);
    } catch {
      // sem armazenamento: a URL já garante o F5
    }
  }, [currentPage, session, recuperandoSenha, confirmandoEmail]);

  function goTo(page: Page) {
    window.history.pushState({}, "", `/${page}`);
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  // Navegação entre /login e /cadastro (só usada quando deslogado)
  // A situação da assinatura é lida uma vez por sessão. Não fica
  // repetindo: o que muda o estado é o webhook, e a tela de
  // Assinatura recarrega sozinha quando o lojista assina ali.
  useEffect(() => {
    if (!session || recuperandoSenha || confirmandoEmail) return;

    let vivo = true;
    lerAssinatura()
      .then((e) => {
        if (vivo) setBloqueada(!e.podeUsar);
      })
      .catch(() => {
        if (vivo) setBloqueada(false);
      });

    return () => {
      vivo = false;
    };
  }, [session, recuperandoSenha, confirmandoEmail]);

  function goToAuth(path: CaminhoPublico) {
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

  if (confirmandoEmail) {
    return (
      <ConfirmarEmail
        onIrParaPainel={() => {
          setConfirmandoEmail(false);
          goTo(paginaInicial());
        }}
        onIrParaLogin={() => {
          setConfirmandoEmail(false);
          window.history.replaceState({}, "", "/login");
          setAuthPath("login");
        }}
      />
    );
  }

  if (recuperandoSenha) {
    return (
      <RedefinirSenha
        temSessao={Boolean(session)}
        onConcluido={() => {
          // A tela de senha já desconectou. Aqui só devolve o app ao
          // login, para o lojista entrar com a senha que acabou de criar.
          setRecuperandoSenha(false);
          window.history.replaceState({}, "", "/login");
          setAuthPath("login");
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

  // Termos e Privacidade são públicos e valem logado ou não: a
  // Stripe lê essas URLs, e quem já é cliente também precisa delas.
  const caminhoAtual = caminhoPublico(window.location.pathname);
  if (caminhoAtual === "termos") return <Termos />;
  if (caminhoAtual === "privacidade") return <Privacidade />;

  if (!session) {
    if (authPath === "cadastro") {
      return (
        <Cadastro
          onSuccess={() => goTo(paginaInicial())}
          onVoltarLogin={() => goToAuth("login")}
        />
      );
    }

    if (authPath === "login") {
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

    // A porta de entrada: quem chega sem conta vê o que é o produto.
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
    return (
      <Apresentacao
        onExperimentar={() => goToAuth("cadastro")}
        /*
         * Assinar passa pelo cadastro também, e isso é o certo: não
         * existe assinatura sem conta. O passo de cobrança em si
         * ainda não existe no sistema — a Edge Function
         * stripe-assinatura-ativar está pronta e ninguém a chama.
         */
        onAssinar={() => goToAuth("cadastro")}
        onEntrar={() => goToAuth("login")}
      />
    );
  }

  // Bloqueio: nem menu nem navegação. Só a cobrança e a saída.
  // O conteúdo não é apagado em lugar nenhum — produtos, pedidos e
  // clientes continuam no banco esperando a assinatura.
  if (bloqueada === true) {
    return (
      <div className="min-h-dvh bg-[var(--app-fundo)] text-[var(--app-texto)]">
        {/* Barra própria, e não o Header: o Header traz o botão de
            menu lateral, e aqui não existe menu para abrir. Um botão
            que não faz nada é pior do que botão nenhum. */}
        <div className="flex h-14 items-center justify-between gap-3 border-b border-[var(--app-borda)] bg-white px-4">
          <span className="t-secao font-bold text-[#0f1117]">Assinatura</span>
          <button
            type="button"
            onClick={logout}
            className="btn-app-pequeno border border-[var(--app-borda)] bg-white text-[#374151]"
          >
            Sair
          </button>
        </div>
        <Assinatura />
      </div>
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
        <AvisoDeTeste onAssinar={() => goTo("assinatura")} />
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

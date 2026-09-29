import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import StoreLayout from "./store/StoreLayout";
import StoreHome from "./store/pages/StoreHome";
import StoreProduct from "./store/pages/StoreProduct";
import StoreCart from "./store/pages/StoreCart";
import StoreCheckout from "./store/pages/StoreCheckout";
import StoreOrderConfirmed from "./store/pages/StoreOrderConfirmed";
import StoreMyOrders from "./store/pages/StoreMyOrders";
import StoreAbout from "./store/pages/StoreAbout";
import {
  resolverDominio,
  type ResultadoDominio,
} from "./store/lib/dominioLoja";

/**
 * Ponto de entrada. Decide entre dois "mundos" — e agora também
 * entre dois tipos de endereço.
 *
 * ----------------------------------------------------------------
 * Pelo domínio da plataforma (moneynotopo.com.br)
 * ----------------------------------------------------------------
 *   /loja/:slug/*  → loja pública
 *   qualquer outra → painel admin (App.tsx)
 *
 * ----------------------------------------------------------------
 * Pelo domínio próprio do lojista (lojadofulano.com.br)
 * ----------------------------------------------------------------
 *   /              → a loja DELE, direto na raiz
 *   qualquer outra → volta para a raiz
 *
 * O painel administrativo NÃO é registrado nesse caso, e isso é o
 * ponto principal: todos os domínios de um projeto na Vercel servem
 * o mesmo código, então sem esta separação o cliente do lojista
 * cairia na tela de login da plataforma ao digitar
 * lojadofulano.com.br/produtos.
 */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-[400px] text-center">
        <h1 className="t-titulo text-[#0f1117]">{titulo}</h1>
        <p className="t-corpo text-[#6b7280] mt-2 leading-snug">{texto}</p>
      </div>
    </div>
  );
}

/**
 * As páginas da loja, escritas uma vez só.
 *
 * É um fragmento de <Route>, não um componente: o React Router lê a
 * árvore de rotas pelos filhos e enxerga dentro de fragmentos. Um
 * componente que devolvesse <Route> não seria lido — o roteador
 * ignoraria as rotas de dentro.
 *
 * Escrever uma vez importa aqui: são as mesmas telas nos dois
 * endereços, e duas cópias divergiriam na primeira página nova.
 */
const PAGINAS_DA_LOJA = (
  <>
    <Route index element={<StoreHome />} />
    <Route path="produto/:productSlug" element={<StoreProduct />} />
    <Route path="carrinho" element={<StoreCart />} />
    <Route path="checkout" element={<StoreCheckout />} />
    <Route path="pedido-confirmado" element={<StoreOrderConfirmed />} />
    <Route path="meus-pedidos" element={<StoreMyOrders />} />
    <Route path="sobre" element={<StoreAbout />} />
  </>
);

export default function RootRouter() {
  const [dominio, setDominio] = useState<ResultadoDominio>({
    modo: "carregando",
  });

  useEffect(() => {
    let vivo = true;

    resolverDominio(window.location.hostname)
      .then((r) => {
        if (vivo) setDominio(r);
      })
      .catch(() => {
        // Se a consulta falhar, cai para o comportamento de sempre.
        // Errar para o lado da plataforma mantém o painel acessível;
        // errar para o outro lado deixaria todo mundo fora do ar.
        if (vivo) setDominio({ modo: "plataforma" });
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (dominio.modo === "carregando") return null;

  if (dominio.modo === "desconhecido") {
    return (
      <Aviso
        titulo="Endereço não configurado"
        texto={`O domínio ${dominio.host} aponta para cá, mas ainda não está ligado a nenhuma loja ativa. Se você é o dono, fale com quem cuida do sistema.`}
      />
    );
  }

  if (dominio.modo === "loja") {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StoreLayout slugForcado={dominio.slug} />}>
            {PAGINAS_DA_LOJA}
          </Route>

          {/* No domínio do lojista não existe painel. Qualquer
              endereço desconhecido volta para a loja dele, em vez de
              mostrar a tela de login da plataforma. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/loja/:slug" element={<StoreLayout />}>
          {PAGINAS_DA_LOJA}
        </Route>

        {/* Qualquer outra rota cai no painel admin, que decide
            internamente (login, cadastro, ou o painel) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

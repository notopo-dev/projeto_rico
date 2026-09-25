import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import StoreLayout from "./store/StoreLayout";
import StoreHome from "./store/pages/StoreHome";
import StoreProduct from "./store/pages/StoreProduct";
import StoreCart from "./store/pages/StoreCart";
import StoreCheckout from "./store/pages/StoreCheckout";
import StoreOrderConfirmed from "./store/pages/StoreOrderConfirmed";
import StoreMyOrders from "./store/pages/StoreMyOrders";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";

/**
 * Ponto de entrada que decide entre dois "mundos":
 * - /loja/:slug/*  → loja pública, sem exigir login, tema próprio
 * - /termos, /privacidade → páginas públicas exigidas pela Stripe
 *   ao revisar o perfil da plataforma (Connect)
 * - qualquer outra rota → painel admin (App.tsx), que continua
 *   controlando sua própria navegação internamente com pushState
 *
 * Use este componente no lugar de <App /> direto no main.tsx.
 */
export default function RootRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/loja/:slug" element={<StoreLayout />}>
          <Route index element={<StoreHome />} />
          <Route path="produto/:productSlug" element={<StoreProduct />} />
          <Route path="carrinho" element={<StoreCart />} />
          <Route path="checkout" element={<StoreCheckout />} />
          <Route path="pedido-confirmado" element={<StoreOrderConfirmed />} />
          <Route path="meus-pedidos" element={<StoreMyOrders />} />
        </Route>

        {/* Públicas, sem login — a Stripe visita estas URLs */}
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />

        {/* Qualquer outra rota cai no painel admin, que decide
            internamente (login, cadastro, ou o painel) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

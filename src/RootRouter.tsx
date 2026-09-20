import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import StoreLayout from "./store/StoreLayout";
import StoreHome from "./store/pages/StoreHome";
import StoreProduct from "./store/pages/StoreProduct";
import StoreCart from "./store/pages/StoreCart";
import StoreCheckout from "./store/pages/StoreCheckout";
import StoreOrderConfirmed from "./store/pages/StoreOrderConfirmed";
import StoreMyOrders from "./store/pages/StoreMyOrders";

/**
 * Ponto de entrada que decide entre dois "mundos":
 * - /loja/:slug/*  → loja pública, sem exigir login, tema próprio
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

        {/* Qualquer outra rota cai no painel admin, que decide
            internamente (login, cadastro, ou o painel) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}
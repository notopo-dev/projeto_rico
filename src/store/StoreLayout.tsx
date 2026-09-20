import { Outlet, useParams } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext";
import { CartProvider } from "./context/CartContext";

export default function StoreLayout() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <StoreProvider>
      <CartProvider storeSlug={slug ?? "default"}>
        <Outlet />
      </CartProvider>
    </StoreProvider>
  );
}
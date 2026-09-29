import { Outlet, useParams } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext";
import { CartProvider } from "./context/CartContext";

/**
 * Moldura da loja pública.
 *
 * `slugForcado` chega quando a loja é aberta pelo domínio próprio
 * do lojista: ali a URL é só "/", sem /loja/:slug para ler. Quem
 * resolve o host e descobre o slug é o RootRouter.
 *
 * O carrinho continua separado por slug. Isso importa: o carrinho
 * vive no navegador, por origem. Quem entrar pela plataforma e
 * depois pelo domínio próprio terá dois carrinhos — não dá para
 * unir, e chavear pelo slug pelo menos mantém cada um coerente.
 */
export default function StoreLayout({
  slugForcado,
}: {
  slugForcado?: string;
}) {
  const params = useParams<{ slug: string }>();
  const slug = slugForcado ?? params.slug;

  return (
    <StoreProvider slug={slug}>
      <CartProvider storeSlug={slug ?? "default"}>
        <Outlet />
      </CartProvider>
    </StoreProvider>
  );
}

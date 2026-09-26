import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Store,
  Package,
  Tag,
  ShoppingBag,
  Users,
  BarChart2,
  CreditCard,
  MessageCircle,
  Settings,
  ChevronDown,
  Landmark,
  X,
} from "lucide-react";

import { getStoreCustomization } from "../lib/storeCustomizationApi";

export type Page =
  | "dashboard"
  | "recebimentos"
  | "loja"
  | "produtos"
  | "categorias"
  | "pedidos"
  | "clientes"
  | "estoque"
  | "vendas"
  | "pagamentos"
  | "whatsapp"
  | "configuracoes";

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  mobileOpen: boolean;
  onClose: () => void;

  storeSlug?: string;
  storeLogoUrl?: string | null;
}

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
}

const groups: {
  label?: string;
  items: NavItem[];
}[] = [
  {
    items: [
      {
        id: "dashboard",
        label: "Visão geral",
        icon: LayoutDashboard,
      },
      {
        id: "loja",
        label: "Loja",
        icon: Store,
      },
      {
        id: "produtos",
        label: "Produtos",
        icon: Package,
      },
      {
        id: "categorias",
        label: "Categorias",
        icon: Tag,
      },
      {
        id: "pedidos",
        label: "Pedidos",
        icon: ShoppingBag,
      },
      {
        id: "clientes",
        label: "Clientes",
        icon: Users,
      },
      {
        id: "estoque",
        label: "Estoque",
        icon: BarChart2,
      },
    ],
  },

  {
    label: "Financeiro",
    items: [
      {
        id: "vendas",
        label: "Vendas",
        icon: BarChart2,
      },
      {
        id: "pagamentos",
        label: "Pagamentos",
        icon: CreditCard,
      },
      {
        id: "recebimentos",
        label: "Recebimentos",
        icon: Landmark,
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        icon: MessageCircle,
      },
    ],
  },

  {
    items: [
      {
        id: "configuracoes",
        label: "Configurações",
        icon: Settings,
      },
    ],
  },
];

export default function Sidebar({
  current,
  onNavigate,
  mobileOpen,
  onClose,
  storeSlug,
  storeLogoUrl,
}: SidebarProps) {
  const [slug, setSlug] = useState(
    storeSlug?.trim() || "minhaloja"
  );

  const [logo, setLogo] = useState<string | null>(
    storeLogoUrl ?? null
  );

  /*
   * BUSCAR SLUG
   */
  useEffect(() => {
    if (storeSlug?.trim()) {
      setSlug(storeSlug.trim());
      return;
    }

    try {
      const possibleKeys = [
        "loja_slug",
        "store_slug",
        "slug_loja",
        "storeSlug",
      ];

      for (const key of possibleKeys) {
        const value = localStorage.getItem(key);

        if (value?.trim()) {
          setSlug(value.trim());
          break;
        }
      }
    } catch {
      // Ignora erro do localStorage
    }
  }, [storeSlug]);

  /*
   * BUSCAR LOGO
   */
  useEffect(() => {
    if (storeLogoUrl !== undefined) {
      setLogo(storeLogoUrl);
      return;
    }

    let mounted = true;

    async function loadLogo() {
      try {
        const data = await getStoreCustomization();

        if (mounted) {
          setLogo(data.logo_url || null);
        }
      } catch {
        // Mantém sem logo caso ocorra erro.
      }
    }

    loadLogo();

    return () => {
      mounted = false;
    };
  }, [storeLogoUrl]);

  /*
   * ATUALIZAÇÃO IMEDIATA
   */
  useEffect(() => {
    function handleStoreUpdated(event: Event) {
      const customEvent = event as CustomEvent<{
        slug?: string;
        logoUrl?: string | null;
      }>;

      const detail = customEvent.detail;

      if (detail?.slug?.trim()) {
        setSlug(detail.slug.trim());
      }

      if (detail && "logoUrl" in detail) {
        setLogo(detail.logoUrl ?? null);
      }
    }

    window.addEventListener(
      "loja-updated",
      handleStoreUpdated
    );

    return () => {
      window.removeEventListener(
        "loja-updated",
        handleStoreUpdated
      );
    };
  }, []);

  const displaySlug = slug.trim() || "minhaloja";

  const initial =
    displaySlug.charAt(0).toUpperCase() || "M";

  return (
    <>
      {/* OVERLAY MOBILE */}
      {mobileOpen && (
        <div
          className="
            fixed inset-0
            bg-black/30
            backdrop-blur-[1px]
            z-30
            lg:hidden
          "
          onClick={onClose}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed top-0 left-0
          h-[100dvh] max-h-[100dvh]
          w-[min(86vw,280px)]
          z-40
          flex flex-col
          bg-white
          border-r border-[#e5e7eb]
          shadow-[8px_0_30px_rgba(0,0,0,0.08)]
          rounded-r-2xl
          overflow-y-auto

          transition-transform duration-200 ease-out

          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}

          lg:translate-x-0
          lg:static
          lg:w-56
          lg:h-full
          lg:rounded-none
          lg:shadow-none
          lg:z-auto
        `}
      >

        {/* LOGO DA PLATAFORMA */}
        <div
          className="
            flex items-center justify-between
            h-12
            shrink-0
            px-4
            border-b border-[#e5e7eb]
          "
        >
          <div className="flex items-center gap-2.5">

            <div
              className="
                w-7 h-7
                rounded-lg
                bg-[#16a34a]
                flex items-center justify-center
                shrink-0
              "
            >
              <Store
                size={15}
                strokeWidth={2}
                className="text-white"
              />
            </div>

            <span
              className="
                font-semibold
                text-[14px]
                text-[#111827]
                tracking-tight
              "
            >
              LojaPro
            </span>

          </div>

          {/* FECHAR MOBILE */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="
              lg:hidden
              w-8 h-8
              rounded-xl
              flex items-center justify-center
              text-[#6b7280]
              hover:bg-[#f4f4f5]
              hover:text-[#111827]
              active:scale-95
              transition-all
            "
          >
            <X
              size={18}
              strokeWidth={2}
            />
          </button>
        </div>

        {/* DADOS DA LOJA */}
        <div
          className="
            px-4
            py-3
            shrink-0
            border-b border-[#e5e7eb]
          "
        >
          <button
            type="button"
            className="
              w-full
              flex items-center gap-2.5
              text-left
              rounded-xl
              transition-colors
              hover:bg-[#f8fafc]
            "
          >

            {/* LOGO DA LOJA */}
            {logo ? (
              <div
                className="
                  w-8 h-8
                  rounded-lg
                  border border-[#e5e7eb]
                  bg-white
                  overflow-hidden
                  flex items-center justify-center
                  shrink-0
                "
              >
                <img
                  src={logo}
                  alt={displaySlug}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="
                  w-8 h-8
                  rounded-lg
                  bg-[#f1f5f9]
                  flex items-center justify-center
                  text-[11px]
                  font-semibold
                  text-[#374151]
                  shrink-0
                "
              >
                {initial}
              </div>
            )}

            {/* SLUG */}
            <div className="flex-1 min-w-0">

              <p
                className="
                  text-[12px]
                  font-medium
                  text-[#111827]
                  truncate
                "
              >
                {displaySlug}
              </p>

              <p
                className="
                  text-[10px]
                  text-[#6b7280]
                  truncate
                  mt-0.5
                "
              >
                {displaySlug}
              </p>

            </div>

            <ChevronDown
              size={15}
              strokeWidth={2}
              className="text-[#9ca3af] shrink-0"
            />

          </button>
        </div>

        {/* NAVEGAÇÃO */}
        <nav
          className="
            flex-1
            overflow-y-auto
            overscroll-contain
            py-2
            px-2
          "
        >
          {groups.map((group, gi) => (
            <div
              key={gi}
              className={`
                ${
                  gi > 0
                    ? "mt-2 pt-2 border-t border-[#f0f0f1]"
                    : ""
                }
              `}
            >

              {/* TÍTULO DO GRUPO */}
              {group.label && (
                <p
                  className="
                    px-3
                    pt-1
                    pb-2
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wider
                    text-[#9ca3af]
                  "
                >
                  {group.label}
                </p>
              )}

              {/* ITENS */}
              <div className="space-y-0.5">

                {group.items.map((item) => {
                  const Icon = item.icon;

                  const active =
                    current === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={`
                        w-full
                        flex items-center
                        gap-3
                        min-h-[42px]
                        px-3
                        rounded-xl
                        text-left
                        text-[13px]
                        transition-all duration-150

                        ${
                          active
                            ? `
                              bg-[#f0fdf4]
                              text-[#15803d]
                              font-medium
                              shadow-sm
                            `
                            : `
                              text-[#374151]
                              hover:bg-[#f8fafc]
                              hover:text-[#111827]
                            `
                        }

                        active:scale-[0.98]

                        lg:min-h-[32px]
                        lg:rounded-lg
                        lg:px-3
                        lg:gap-2.5
                      `}
                    >

                      <span
                        className={`
                          w-7 h-7
                          rounded-lg
                          flex items-center
                          justify-center
                          shrink-0

                          ${
                            active
                              ? "bg-[#dcfce7]"
                              : "bg-transparent"
                          }
                        `}
                      >
                        <Icon
                          size={17}
                          strokeWidth={
                            active ? 2 : 1.8
                          }
                        />
                      </span>

                      <span className="truncate">
                        {item.label}
                      </span>

                    </button>
                  );
                })}

              </div>
            </div>
          ))}
        </nav>

        {/* SUPORTE WHATSAPP */}
        <div className="px-2 pb-2 shrink-0">
          <a
            href="https://wa.me/557792084268"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar com o suporte pelo WhatsApp"
            className="
              w-full
              flex items-center
              gap-3
              min-h-[42px]
              px-3
              rounded-xl
              text-left
              text-[13px]
              font-medium
              text-[#15803d]
              bg-[#f0fdf4]
              border border-[#dcfce7]
              shadow-sm
              hover:bg-[#dcfce7]
              hover:text-[#166534]
              active:scale-[0.98]
              transition-all duration-150

              lg:min-h-[32px]
              lg:rounded-lg
              lg:px-3
              lg:gap-2.5
            "
          >
            <span
              className="
                w-7 h-7
                rounded-lg
                flex items-center
                justify-center
                shrink-0
                bg-[#dcfce7]
              "
            >
              <MessageCircle
                size={17}
                strokeWidth={2}
              />
            </span>

            <span className="truncate">
              Suporte
            </span>
          </a>
        </div>

        {/* ESPAÇO INFERIOR */}
        <div className="h-2 shrink-0 bg-white" />

      </aside>
    </>
  );
}
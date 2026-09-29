import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
} from "lucide-react";

import { getStoreCustomization } from "../lib/storeCustomizationApi";

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
  onLogout: () => void;
  storeSlug?: string;
  storeLogoUrl?: string | null;
}

export default function Header({
  title,
  onMenuToggle,
  onLogout,
  storeSlug,
  storeLogoUrl,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  const [slug, setSlug] = useState(
    storeSlug?.trim() || "minhaloja"
  );

  const [logo, setLogo] = useState<string | null>(
    storeLogoUrl ?? null
  );

  // Nome da loja, da mesma consulta que traz o logo.
  const [nome, setNome] = useState<string | null>(null);

  /*
   * Busca o slug da loja.
   * A prioridade é:
   * 1. storeSlug recebido pelo App
   * 2. localStorage
   * 3. minhaloja como fallback
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
   * Busca a logo salva em Configurações.
   */
  useEffect(() => {
    if (storeLogoUrl !== undefined) {
      setLogo(storeLogoUrl);
      // Sem return: o logo pode ter vindo por prop, mas o NOME ainda
      // precisa ser buscado.
    }

    let mounted = true;

    async function loadLogo() {
      try {
        const data = await getStoreCustomization();

        if (mounted) {
          if (storeLogoUrl === undefined) setLogo(data.logo_url || null);
          if (data.nome?.trim()) setNome(data.nome.trim());
          if (data.slug?.trim()) setSlug(data.slug.trim());
        }
      } catch {
        // Mantém sem logo caso não consiga carregar.
      }
    }

    loadLogo();

    return () => {
      mounted = false;
    };
  }, [storeLogoUrl]);

  /*
   * Permite atualizar Header imediatamente quando
   * a loja for alterada.
   */
  useEffect(() => {
    function handleStoreUpdated(event: Event) {
      const customEvent = event as CustomEvent<{
        nome?: string;
        slug?: string;
        logoUrl?: string | null;
      }>;

      const detail = customEvent.detail;

      if (detail?.nome?.trim()) {
        setNome(detail.nome.trim());
      }

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

  const displayNome = nome?.trim() || slug.trim() || "Minha loja";

  const initial =
    displaySlug.charAt(0).toUpperCase() || "M";

  return (
    <header className="sticky top-0 z-20 flex h-14 sm:h-12 w-full shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-3.5 sm:px-4">

      {/* ESQUERDA */}
      <div className="flex min-w-0 items-center gap-2.5">

        {/* O celular navega pela barra inferior, então o menu lateral
            só aparece em tablet (sm a lg). Dois menus para a mesma
            coisa confunde e ocupa espaço. */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="hidden sm:flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-[#f4f4f5] hover:text-[#0f1117] active:scale-95"
          aria-label="Abrir menu"
        >
          <Menu
            size={18}
            strokeWidth={2}
          />
        </button>

        <h1 className="t-secao min-w-0 truncate font-bold text-[#0f1117] sm:font-semibold">
          {title}
        </h1>
      </div>

      {/* DIREITA */}
      <div className="flex shrink-0 items-center gap-0.5">

        {/* NOTIFICAÇÕES */}
        <button
          type="button"
          className="relative flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-[#f4f4f5] hover:text-[#0f1117] active:scale-95"
          aria-label="Notificações"
        >
          <Bell
            size={17}
            strokeWidth={1.8}
          />

          {/* A bolinha verde saiu daqui.
              Ela era fixa no código: ficava sempre acesa, indicando
              notificação não lida numa loja que nunca teve
              notificação nenhuma. Quando o sino passar a ler de
              verdade, o ponto volta ligado à contagem — não antes. */}
        </button>

        {/* LOJA */}
        <div className="relative">

          <button
            type="button"
            onClick={() =>
              setProfileOpen((open) => !open)
            }
            className="ml-0.5 flex h-10 sm:h-8 items-center gap-1.5 rounded-lg pl-1.5 pr-1 transition hover:bg-[#f4f4f5] active:scale-[0.98]"
            aria-expanded={profileOpen}
          >

            {/* LOGO */}
            {logo ? (
              <span className="flex h-8 w-8 sm:h-6 sm:w-6 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:rounded-lg border border-[#e5e7eb] bg-white">
                <img
                  src={logo}
                  alt={displaySlug}
                  className="h-full w-full object-cover"
                />
              </span>
            ) : (
              <span className="t-apoio flex h-8 w-8 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-lg sm:rounded-lg bg-[#e5e7eb] font-semibold text-[#374151]">
                {initial}
              </span>
            )}

            {/* SLUG */}
            <span className="t-corpo hidden max-w-[140px] truncate text-[#374151] sm:block">
              {displaySlug}
            </span>

            <ChevronDown
              size={13}
              strokeWidth={2}
              className="shrink-0 text-[#9ca3af]"
            />
          </button>

          {/* MENU */}
          {profileOpen && (
            <div className="absolute right-0 top-12 sm:top-10 z-50 w-52 sm:w-48 rounded-lg border border-[#e5e7eb] bg-white p-1.5 shadow-lg">

              <div className="border-b border-[#f0f0f1] px-3 py-2.5">
                <p className="t-corpo truncate font-medium text-[#111827]">
                  {displayNome}
                </p>

                <p className="t-micro mt-0.5 truncate text-[#9ca3af]">
                  /loja/{displaySlug}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="t-corpo toque mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left font-medium text-[#b91c1c] hover:bg-[#fef2f2]"
              >
                <LogOut
                  size={14}
                  strokeWidth={1.8}
                />

                Sair da conta
              </button>

            </div>
          )}

        </div>
      </div>
    </header>
  );
}
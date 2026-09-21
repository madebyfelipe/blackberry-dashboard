"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import {
  BellIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  PanelsIcon,
  PencilIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  SquareCheckIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

/*
 * Navegação do shell autenticado.
 *
 * Duas formas, mesmo conteúdo:
 * - a partir de `md`, a barra lateral fixa de 256px do design;
 * - abaixo disso, uma barra de topo enxuta e a mesma lateral entrando como
 *   gaveta sobre a tela.
 *
 * A lateral era `w-64` sem breakpoint: em 390px ela comia a largura toda e
 * sobravam 86px para o conteúdo — o app inteiro ficava inutilizável no
 * celular. A gaveta é uma solução provisória e deliberadamente sóbria (mesmos
 * tokens, mesma ordem de itens), até existir um desenho de mobile.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
};

const NAV: NavItem[] = [
  { href: "/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/tarefas", label: "Tarefas", Icon: SquareCheckIcon },
  { href: "/social", label: "Social media", Icon: PlayIcon },
  { href: "/clientes", label: "Clientes", Icon: PanelsIcon },
  { href: "/equipe", label: "Equipe", Icon: UsersIcon },
  { href: "/configuracoes", label: "Configurações", Icon: SettingsIcon },
];

const ROLE_LABEL: Record<PublicUser["role"], string> = {
  coordenacao: "Coordenação",
  social: "Social media",
  designer: "Designer",
};

export function Sidebar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Trocar de tela fecha a gaveta — senão ela fica por cima do destino.
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      {/* Barra de topo — só no celular */}
      <div className="bg-sidebar-gradient flex shrink-0 items-center justify-between rounded-card border border-border px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menu"
            aria-expanded={drawer}
            className="tap flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-surface hover:text-fg-soft"
          >
            <MenuIcon size={20} />
          </button>
          <Link href="/tarefas" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-mark bg-dim text-[15px] font-bold text-fg">
              b
            </span>
            <span className="text-[16px] font-semibold text-fg-soft">
              black berry
            </span>
          </Link>
        </div>
        <Link
          href="/configuracoes"
          aria-label="Sua conta"
          className="tap flex h-9 w-9 items-center justify-center rounded-pill bg-border-strong text-[13px] font-medium text-fg"
        >
          {initial}
        </Link>
      </div>

      {/* Gaveta — só no celular, por cima do conteúdo */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-[2px]"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] animate-slide-in-left p-3">
            <SidebarPanel
              user={user}
              pathname={pathname}
              onClose={() => setDrawer(false)}
            />
          </div>
        </div>
      )}

      {/* Lateral fixa — do `md` para cima */}
      <div className="hidden w-64 shrink-0 md:flex">
        <SidebarPanel user={user} pathname={pathname} />
      </div>
    </>
  );
}

function SidebarPanel({
  user,
  pathname,
  onClose,
}: {
  user: PublicUser;
  pathname: string;
  /** Presente só na gaveta do celular. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLeaving(false);
      toast("Não foi possível sair. Tente de novo.", "error");
    }
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className="bg-sidebar-gradient flex h-full w-full flex-col rounded-card border border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <Link href="/tarefas" className="group flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-mark bg-dim text-[15px] font-bold text-fg transition-transform duration-200 group-hover:scale-110">
            b
          </span>
          <span className="text-[16px] font-semibold text-fg-soft">
            black berry
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-fg-3">
          {onClose ? (
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={onClose}
              className="tap transition-colors hover:text-fg-soft"
            >
              <XIcon size={18} />
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label="Buscar"
                onClick={() => toast("A busca global chega junto com o Inbox.", "info")}
                className="tap transition-colors hover:text-fg-soft"
              >
                <SearchIcon size={18} />
              </button>
              <button
                type="button"
                aria-label="Criar"
                onClick={() => router.push("/tarefas?novo=1")}
                className="tap transition-colors hover:text-fg-soft"
              >
                <PencilIcon size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
        {NAV.map(({ href, label, Icon }, i) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              style={{ ["--d" as string]: i }}
              className={cn(
                // A linha inteira desliza 2px no hover: o item "vem à frente"
                // sem mexer no espaçamento da lista.
                "stagger-item group relative flex items-center gap-3 rounded-field px-4 py-[11px] text-[15px]",
                "transition-[background-color,color,transform] duration-200 hover:translate-x-0.5",
                active
                  ? "bg-border font-semibold text-fg-soft"
                  : "font-normal text-fg-3 hover:bg-surface hover:text-fg-soft",
              )}
            >
              {/*
               * A tela atual se anuncia como no export "2. Gradiente": fundo
               * `bg-border` no raio de 24px, rótulo semibold e ícone claro.
               * Havia aqui um marcador de 3px colado em `left-0`, mas o item
               * é uma pílula (raio 24px numa linha de 44px, ou seja, a borda
               * esquerda é meia-lua): o recorte arredondado comia quase todo
               * o marcador e sobrava a lasca que o Felipe fotografou.
               */}
              <Icon size={18} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — conta */}
      <div className="relative flex items-center justify-between gap-3 p-5" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="tap flex min-w-0 flex-1 items-center gap-3 rounded-field p-1 text-left transition-colors hover:bg-surface/70"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-border-strong text-[14px] font-medium text-fg">
            {initial}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[14px] font-semibold text-fg-soft">
              {user.name}
            </span>
            <span className="truncate text-[12px] text-fg-3">
              {ROLE_LABEL[user.role]}
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-label="Notificações"
          onClick={() => toast("As notificações chegam com o Inbox.", "info")}
          className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
        >
          <BellIcon size={20} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-[calc(100%-4px)] left-5 z-50 w-[210px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-col gap-0.5 px-2.5 py-2">
              <span className="truncate text-[13px] font-semibold text-fg-soft">
                {user.agency}
              </span>
              <span className="truncate text-[11px] text-muted">{user.email}</span>
            </div>
            <div className="p-1">
              <div className="h-px bg-border" />
            </div>
            <Link
              href="/configuracoes"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-mark px-2.5 py-1.5 text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
            >
              <SettingsIcon size={14} className="text-muted" />
              Configurações
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={leaving}
              className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-1.5 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <LogOutIcon size={14} className="text-muted" />
              {leaving ? "Saindo…" : "Sair"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

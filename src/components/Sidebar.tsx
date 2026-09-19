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
  PanelsIcon,
  PencilIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  SquareCheckIcon,
  UsersIcon,
} from "@/components/icons";

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
    <aside className="bg-sidebar-gradient flex w-64 shrink-0 flex-col rounded-card border border-border">
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
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-4 py-2">
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
                "stagger-item group relative flex items-center gap-3 overflow-hidden rounded-field px-4 py-[11px] text-[15px]",
                "transition-[background-color,color,transform] duration-200 hover:translate-x-0.5",
                active
                  ? "bg-border font-semibold text-fg-soft"
                  : "font-normal text-fg-3 hover:bg-surface hover:text-fg-soft",
              )}
            >
              {/* Marcador da tela atual — cresce de dentro para fora. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-pill bg-primary transition-transform duration-200",
                  active ? "scale-y-100" : "scale-y-0",
                )}
              />
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

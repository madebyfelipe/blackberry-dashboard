"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  BellIcon,
  InboxIcon,
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col rounded-card border border-border bg-surface-2">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <Link href="/tarefas" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-mark bg-[#616161] text-[15px] font-bold text-fg">
            b
          </span>
          <span className="text-[16px] font-semibold text-fg-soft">
            black berry
          </span>
        </Link>
        <div className="flex items-center gap-1.5 text-fg-3">
          <button type="button" aria-label="Buscar" className="hover:text-fg-soft">
            <SearchIcon size={18} />
          </button>
          <button type="button" aria-label="Criar" className="hover:text-fg-soft">
            <PencilIcon size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-4 py-2">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-field px-4 py-[11px] text-[15px]",
                active
                  ? "bg-border font-semibold text-fg-soft"
                  : "font-normal text-fg-3 hover:bg-surface hover:text-fg-soft",
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-border-strong text-[14px] font-medium text-fg">
            F
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-fg-soft">
              Felipe
            </span>
            <span className="text-[12px] text-fg-3">Coordenação</span>
          </div>
        </div>
        <button type="button" aria-label="Notificações" className="text-fg-3 hover:text-fg-soft">
          <BellIcon size={20} />
        </button>
      </div>
    </aside>
  );
}

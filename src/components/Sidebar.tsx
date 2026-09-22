"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import { apiMyPresence, apiSetPresence } from "@/components/inbox/api";
import { PresenceDot } from "@/components/inbox/PresenceDot";
import { PRESENCES } from "@/lib/inbox/constants";
import type { Presence } from "@/lib/inbox/types";
import {
  BellIcon,
  ChartLineIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PanelLeftIcon,
  PanelsIcon,
  PlayIcon,
  PlusIcon,
  SettingsIcon,
  SquareCheckIcon,
  UsersIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons";

/*
 * Navegação do shell autenticado — design system v3.
 *
 * O painel é preto (não mais o gradiente do v2), raio de 24px, e a lista vem
 * em três blocos: a linha de "Ações rápidas" com o atalho `/`, o grupo de
 * caixas de entrada e, abaixo dos rótulos de seção, os destinos de Trabalho e
 * de Equipe. Item ativo é uma faixa `border` de raio 12 com o rótulo em
 * semibold.
 *
 * Duas formas, mesmo conteúdo: a partir de `md` a lateral fixa de 256px; abaixo
 * disso, barra de topo + a mesma lateral como gaveta (a lateral fixa em 390px
 * deixava 86px de conteúdo). A gaveta segue provisória até existir desenho de
 * mobile.
 */

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
};

/** Caixas de entrada — o bloco de cima, antes dos rótulos de seção. */
const INBOXES: NavItem[] = [
  { href: "/notificacoes", label: "Notificações", Icon: BellIcon },
  { href: "/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/conversas", label: "Conversas", Icon: MessageSquareIcon },
];

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Trabalho",
    items: [
      { href: "/tarefas", label: "Tarefas", Icon: SquareCheckIcon },
      { href: "/social", label: "Social media", Icon: PlayIcon },
      { href: "/clientes", label: "Clientes", Icon: PanelsIcon },
      { href: "/relatorios", label: "Relatórios", Icon: ChartLineIcon },
    ],
  },
  {
    title: "Equipe",
    items: [
      { href: "/equipe", label: "Membros", Icon: UsersIcon },
      { href: "/configuracoes", label: "Configurações", Icon: SettingsIcon },
    ],
  },
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
      <div className="flex shrink-0 items-center justify-between rounded-card border border-border bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menu"
            aria-expanded={drawer}
            className="tap flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft"
          >
            <MenuIcon size={20} />
          </button>
          <Link href="/tarefas" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-mark bg-dim text-[15px] font-bold text-fg">
              b
            </span>
            <span className="text-[15px] font-semibold text-fg-soft">
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
  const [quickOpen, setQuickOpen] = useState(false);
  /*
   * A disponibilidade de quem está logado (Inbox, issue #30). Mora no menu da
   * conta porque é aqui que "você" está na tela inteira — e porque ela vale em
   * todo o produto, não só dentro do Inbox. Só é buscada quando o menu abre:
   * é um dado do Inbox, e nenhuma outra tela deve pagar por ele ao carregar.
   */
  const [presence, setPresence] = useState<Presence | null>(null);
  const [leaving, setLeaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen || presence) return;
    let alive = true;
    apiMyPresence()
      .then((me) => alive && setPresence(me.presence))
      // Sem resposta, o menu simplesmente não mostra o status — nada quebra.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [menuOpen, presence]);

  useEffect(() => {
    if (!quickOpen) return;
    function onDown(e: MouseEvent) {
      if (!quickRef.current?.contains(e.target as Node)) setQuickOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [quickOpen]);

  /*
   * "/" abre as ações rápidas, como o desenho promete na própria linha. Sai do
   * caminho enquanto a pessoa digita em qualquer campo.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setQuickOpen((o) => !o);
      } else if (e.key === "Escape") {
        setQuickOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    <aside className="flex h-full w-full flex-col rounded-card bg-bg">
      {/* Header — marca + troca de workspace */}
      <div className="flex items-center justify-between p-6">
        <Link href="/tarefas" className="group flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-mark bg-dim text-[15px] font-bold text-fg transition-transform duration-200 group-hover:scale-110">
            b
          </span>
          <span className="text-[15px] font-semibold text-fg-soft">
            black berry
          </span>
        </Link>
        {onClose ? (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="tap text-fg-3 transition-colors hover:text-fg-soft"
          >
            <XIcon size={18} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Trocar de agência"
            onClick={() =>
              toast(
                "Uma conta ainda pertence a uma agência só — a troca chega com o convite de equipe.",
                "info",
              )
            }
            className="tap text-fg-3 transition-colors hover:text-fg-soft"
          >
            <ChevronsUpDownIcon size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-2 pt-1">
        {/* Ações rápidas — a única linha com caixa própria */}
        <div className="relative" ref={quickRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={quickOpen}
            onClick={() => setQuickOpen((o) => !o)}
            className="tap flex w-full items-center gap-3 rounded-nav border border-border bg-surface-2 px-3 py-[9px] text-left transition-colors hover:bg-border"
          >
            <ZapIcon size={16} className="text-fg-3" />
            <span className="flex-1 text-[13px] text-fg-3">Ações rápidas</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-check border border-border-strong text-[11px] font-medium text-muted">
              /
            </span>
          </button>

          {quickOpen && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+6px)] z-50 w-full animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              <QuickAction
                label="Nova tarefa"
                onSelect={() => {
                  setQuickOpen(false);
                  router.push("/tarefas?novo=1");
                }}
              />
              <QuickAction
                label="Novo cliente"
                onSelect={() => {
                  setQuickOpen(false);
                  router.push("/clientes?novo=1");
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0.5 pt-2.5">
          {INBOXES.map((item, i) => (
            <NavLink key={item.href} item={item} pathname={pathname} index={i} />
          ))}
        </div>

        {SECTIONS.map((section, s) => (
          <div key={section.title} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1.5 pt-3.5 text-[11px] font-semibold tracking-[0.4px] text-muted">
              {section.title}
            </p>
            {section.items.map((item, i) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                index={INBOXES.length + s * 4 + i}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — conta */}
      <div className="relative flex items-center justify-between gap-3 p-5" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="tap flex min-w-0 flex-1 items-center gap-3 rounded-field p-1 text-left transition-colors hover:bg-surface-2/70"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-border-strong text-[14px] font-medium text-fg">
            {initial}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[11px] font-semibold text-fg-soft">
              {user.name}
            </span>
            <span className="truncate text-[11px] text-fg-3">
              {ROLE_LABEL[user.role]}
            </span>
          </span>
        </button>

        {/*
         * O desenho põe aqui o ícone de recolher a lateral. Recolher tem um
         * estado próprio — a lateral estreita, só com os ícones — e esse
         * estado ainda não foi desenhado; inventá-lo seria inventar tela. Até
         * lá o botão existe, com a forma do export, e diz isso em voz alta.
         */}
        <button
          type="button"
          aria-label="Recolher a lateral"
          onClick={() =>
            toast("Recolher a lateral chega com o desenho dela.", "info")
          }
          className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
        >
          <PanelLeftIcon size={18} />
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
            {presence && (
              <>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold tracking-[0.4px] text-muted">
                  Status
                </p>
                {PRESENCES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={presence === option.id}
                    onClick={async () => {
                      const previous = presence;
                      setPresence(option.id);
                      try {
                        await apiSetPresence(option.id);
                      } catch {
                        setPresence(previous);
                        toast("Não foi possível mudar seu status.", "error");
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-mark px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                      presence === option.id ? "text-fg-soft" : "text-fg-3",
                    )}
                  >
                    <PresenceDot presence={option.id} size={10} />
                    <span className="flex-1">{option.label}</span>
                    {presence === option.id && (
                      <CheckIcon size={13} className="text-muted" />
                    )}
                  </button>
                ))}
                <div className="p-1">
                  <div className="h-px bg-border" />
                </div>
              </>
            )}
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

function NavLink({
  item,
  pathname,
  index,
}: {
  item: NavItem;
  pathname: string;
  index: number;
}) {
  const { href, label, Icon } = item;
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{ ["--d" as string]: index }}
      className={cn(
        "stagger-item flex items-center gap-3 rounded-nav px-3 py-[9px] text-[13px]",
        "transition-[background-color,color,transform] duration-200 hover:translate-x-0.5",
        active
          ? "bg-border font-semibold text-fg-soft"
          : "font-normal text-fg-3 hover:bg-surface-2 hover:text-fg-soft",
      )}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

function QuickAction({
  label,
  onSelect,
}: {
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-border"
    >
      <PlusIcon size={14} className="text-muted" />
      {label}
    </button>
  );
}

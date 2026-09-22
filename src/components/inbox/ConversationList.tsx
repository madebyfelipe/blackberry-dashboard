"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { BellOffIcon, SearchIcon, SlidersIcon, SquarePenIcon } from "@/components/icons";
import type {
  ConversationSummary,
  InboxMember,
} from "@/lib/inbox/types";
import { listTime, matchesQuery, splitByKind } from "@/lib/inbox/view";
import { PresenceBadge, PresenceDot } from "./PresenceDot";

/*
 * A coluna de 300px do export: "Mensagens", busca, e as conversas em duas
 * seções — GRUPOS e DIRETAS. É a lista inteira do Inbox; quem abre uma
 * conversa é a tela (`InboxView`), que também é dona do estado.
 *
 * No celular ela ocupa a largura toda e sai de cena quando uma conversa está
 * aberta — 300px de lista sobre 390px de tela não deixariam chat nenhum.
 */

export function ConversationList({
  conversations,
  members,
  me,
  openId,
  query,
  onQuery,
  onlyUnread,
  onToggleUnread,
  onOpen,
  onStartDirect,
  className,
}: {
  conversations: ConversationSummary[];
  members: InboxMember[];
  me: InboxMember;
  openId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onlyUnread: boolean;
  onToggleUnread: () => void;
  onOpen: (id: string) => void;
  onStartDirect: (memberId: string) => void;
  className?: string;
}) {
  const visible = conversations.filter(
    (c) => matchesQuery(c, query) && (!onlyUnread || c.unread > 0),
  );
  const { grupos, diretas } = splitByKind(visible);
  const empty = visible.length === 0;

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col border-panel-ring md:w-[300px] md:shrink-0 md:border-r",
        className,
      )}
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-panel-ring px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[15px] font-semibold text-fg">Mensagens</h1>
          <div className="flex shrink-0 items-center gap-1">
            <HeaderAction
              label={onlyUnread ? "Mostrar todas as conversas" : "Só não lidas"}
              pressed={onlyUnread}
              onClick={onToggleUnread}
            >
              <SlidersIcon size={14} />
            </HeaderAction>
            <NewDirect members={members} me={me} onSelect={onStartDirect} />
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-chip border border-panel-ring bg-surface-2 px-2.5 py-2">
          <SearchIcon size={13} className="text-muted" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
            className="w-full bg-transparent text-[12px] text-fg-soft outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4 pt-2">
        {empty && (
          <p className="px-2.5 py-6 text-[12px] leading-[18px] text-muted">
            {query || onlyUnread
              ? "Nenhuma conversa aqui."
              : "Ninguém começou uma conversa ainda. Use o lápis acima para falar com alguém do time."}
          </p>
        )}

        {grupos.length > 0 && <SectionLabel>GRUPOS</SectionLabel>}
        {grupos.map((c, i) => (
          <Item
            key={c.id}
            item={c}
            index={i}
            active={c.id === openId}
            onOpen={onOpen}
          />
        ))}

        {diretas.length > 0 && <SectionLabel>DIRETAS</SectionLabel>}
        {diretas.map((c, i) => (
          <Item
            key={c.id}
            item={c}
            index={grupos.length + i}
            active={c.id === openId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1.5 pt-3 text-[11px] font-semibold tracking-[0.6px] text-muted">
      {children}
    </p>
  );
}

function HeaderAction({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "tap flex h-7 w-7 items-center justify-center rounded-chip transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        pressed
          ? "bg-border text-fg-soft"
          : "text-fg-3 hover:bg-surface-2 hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}

/**
 * O lápis do topo: com quem falar. Só direta — grupo novo (nome, quem entra,
 * quem sai) é tela à parte e ainda não tem desenho.
 */
function NewDirect({
  members,
  me,
  onSelect,
}: {
  members: InboxMember[];
  me: InboxMember;
  onSelect: (memberId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = members.filter((m) => m.id !== me.id);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <HeaderAction
        label="Nova conversa"
        pressed={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SquarePenIcon size={14} />
      </HeaderAction>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {others.length === 0 ? (
            <p className="px-2.5 py-2 text-[12px] leading-[17px] text-muted">
              Você é a única pessoa da agência por aqui. Convite de equipe ainda
              não existe — ver ROADMAP.
            </p>
          ) : (
            others.map((m) => (
              <button
                key={m.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect(m.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-border"
              >
                <PresenceDot presence={m.presence} size={9} />
                <span className="truncate">{m.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  item,
  index,
  active,
  onOpen,
}: {
  item: ConversationSummary;
  index: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const unread = item.unread > 0;
  const ring = active ? "bg-row-raised" : "bg-surface";

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      aria-current={active ? "true" : undefined}
      style={{ ["--d" as string]: index }}
      className={cn(
        "stagger-item tap flex w-full items-center gap-2.5 rounded-chip px-2.5 py-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        active ? "bg-row-raised" : "hover:bg-surface-2",
      )}
    >
      {item.kind === "grupo" ? (
        <span className="relative h-8 w-8 shrink-0" aria-hidden="true">
          <span
            className={cn(
              "absolute left-2.5 top-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-pill bg-border text-[8px] font-semibold text-fg-3 outline-2",
              active ? "outline-row-raised" : "outline-surface",
            )}
          >
            {item.initials[1] || "—"}
          </span>
          <span
            className={cn(
              "absolute left-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-pill bg-border-strong text-[8px] font-semibold text-fg outline-2",
              active ? "outline-row-raised" : "outline-surface",
            )}
          >
            {item.initials[0]}
          </span>
        </span>
      ) : (
        <span className="relative h-8 w-8 shrink-0">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-pill bg-border text-[11px] font-semibold text-fg-3"
            aria-hidden="true"
          >
            {item.initials[0]}
          </span>
          {item.presence && (
            <PresenceBadge presence={item.presence} ring={ring} size={9} />
          )}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[13px]",
              unread ? "font-semibold text-fg" : "font-medium text-fg-soft",
            )}
          >
            {item.title}
          </span>
          <span
            className={cn(
              "shrink-0 text-[10px]",
              unread ? "text-fg-3" : "text-muted",
            )}
          >
            {listTime(item.lastAt)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[12px]",
              unread ? "text-fg-3" : "text-muted",
            )}
          >
            {item.preview || "Sem mensagens ainda"}
          </span>
          {unread ? (
            <span className="flex h-4 shrink-0 items-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary">
              {item.unread}
              <span className="sr-only"> não lidas</span>
            </span>
          ) : (
            item.muted && (
              <BellOffIcon
                size={11}
                className="shrink-0 text-muted"
              />
            )
          )}
        </span>
      </span>
    </button>
  );
}

"use client";

import { MemberAvatar } from "./MemberAvatar";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { BellOffIcon, PhoneIcon, SearchIcon, SlidersIcon, SquarePenIcon } from "@/components/icons";
import type {
  ConversationSummary,
  InboxMember,
} from "@/lib/inbox/types";
import { listTime, matchesQuery, splitByKind } from "@/lib/inbox/view";
import { MemberMenuPanel } from "./MemberMenu";
import { PresenceBadge } from "./PresenceDot";

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
          <h1 className="text-[20px] font-semibold text-fg md:text-[15px]">Mensagens</h1>
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

        <label className="flex items-center gap-2 rounded-chip border border-panel-ring bg-surface-2 px-3 py-1.5 md:px-2.5 md:py-2">
          <SearchIcon size={13} className="text-muted" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Buscar conversas"
            aria-label="Buscar conversas"
            // 16px no celular: abaixo disso o iPhone dá zoom ao focar a busca.
            className="w-full bg-transparent text-[16px] text-fg-soft outline-none placeholder:text-muted md:text-[12px]"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 md:pb-4">
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
 * O lápis do topo: com quem falar. Só direta — grupo nasce do "adicionar
 * alguém" dentro de uma conversa (ver `ChatPane`).
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
        <MemberMenuPanel
          members={others}
          emptyText="Você é a única pessoa da agência por aqui. Convite de equipe ainda não existe — ver ROADMAP."
          onSelect={(id) => {
            setOpen(false);
            onSelect(id);
          }}
        />
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
        "stagger-item tap flex w-full items-center gap-3 rounded-chip px-2.5 py-2.5 text-left transition-colors md:gap-2.5 md:py-2",
        "active:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        active ? "bg-row-raised" : "hover:bg-surface-2",
      )}
    >
      {item.kind === "grupo" ? (
        // No celular o avatar cresce 25% inteiro (a pilha do grupo junto) — mais fácil de reconhecer.
        <span className="relative h-8 w-8 shrink-0 max-md:[zoom:1.25]" aria-hidden="true">
          <MemberAvatar
            name=""
            initials={item.initials[1] || "—"}
            photoUrl={item.photos?.[1]}
            className={cn(
              "absolute left-2.5 top-2.5 h-[22px] w-[22px] bg-border text-[8px] font-semibold text-fg-3 outline-2",
              active ? "outline-row-raised" : "outline-surface",
            )}
          />
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
        <span className="relative h-8 w-8 shrink-0 max-md:[zoom:1.25]">
          <MemberAvatar
            name=""
            initials={item.initials[0]}
            photoUrl={item.photos?.[0]}
            className="h-8 w-8 bg-border text-[11px] font-semibold text-fg-3"
          />
          {item.presence && (
            <PresenceBadge presence={item.presence} ring={ring} size={9} />
          )}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[15px] md:text-[13px]",
              unread ? "font-semibold text-fg" : "font-medium text-fg-soft",
            )}
          >
            {item.title}
          </span>
          {item.callMemberIds.length > 0 ? (
            // Chamada acontecendo: dá para ver da lista, sem abrir a conversa.
            <span
              title={`${item.callMemberIds.length} na chamada agora`}
              className="flex shrink-0 items-center gap-1 rounded-pill bg-border px-1.5 py-px text-[10px] font-semibold text-fg-soft"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-presence-on" aria-hidden="true" />
              <PhoneIcon size={10} />
              {item.callMemberIds.length}
              <span className="sr-only"> na chamada agora</span>
            </span>
          ) : (
            <span
              className={cn(
                "shrink-0 text-[12px] md:text-[10px]",
                unread ? "text-fg-3" : "text-muted",
              )}
            >
              {listTime(item.lastAt)}
            </span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[14px] md:text-[12px]",
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

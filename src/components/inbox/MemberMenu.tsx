"use client";

import type { InboxMember } from "@/lib/inbox/types";
import { PresenceDot } from "./PresenceDot";

/*
 * A lista de gente do time num menu flutuante: a do lápis "Nova conversa" e a
 * do "Adicionar alguém" da conversa. É o mesmo painel nos dois lugares — o
 * que o lápis já desenhava —, então mora aqui, e um ajuste de forma vale para
 * os dois.
 */
export function MemberMenuPanel({
  members,
  heading,
  emptyText,
  onSelect,
}: {
  members: InboxMember[];
  /** Uma linha acima da lista dizendo o que o clique faz. */
  heading?: string;
  emptyText: string;
  onSelect: (memberId: string) => void;
}) {
  return (
    <div
      role="menu"
      aria-label={heading}
      className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-[220px] animate-pop-in overflow-y-auto rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      {heading && (
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] leading-[15px] text-muted">{heading}</p>
      )}
      {members.length === 0 ? (
        <p className="px-2.5 py-2 text-[12px] leading-[17px] text-muted">{emptyText}</p>
      ) : (
        members.map((m) => (
          <button
            key={m.id}
            type="button"
            role="menuitem"
            onClick={() => onSelect(m.id)}
            className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-border"
          >
            <PresenceDot presence={m.presence} size={9} />
            <span className="truncate">{m.name}</span>
          </button>
        ))
      )}
    </div>
  );
}

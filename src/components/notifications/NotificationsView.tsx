"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenAction, ScreenHeader } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { NOTIFICATIONS_CHANGED } from "@/components/inbox/InboxNotifier";
import {
  AtSignIcon,
  BellIcon,
  CheckIcon,
  GitBranchIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  UserPenIcon,
  XIcon,
} from "@/components/icons";
import { initialsOf, messageTime } from "@/lib/inbox/view";
import { SYSTEM_ACTOR } from "@/lib/notifications/rules";
import type { AppNotification, NotificationKind } from "@/lib/notifications/types";
import {
  KIND_LABEL,
  NOTIFICATION_TABS,
  countLabel,
  groupNotificationsByDay,
  inTab,
  unreadTotal,
  type NotificationTab,
} from "@/lib/notifications/view";

/*
 * Notificações — a caixa do que aconteceu com você.
 *
 * Montada com o vocabulário v3 que já existe (painel, trilha, abas em
 * pílula, linhas de lista, blocos por dia do Inbox) enquanto o desenho
 * próprio dela não chega: é o placeholder funcional, fácil de trocar.
 *
 * Clicar numa notificação a dá por lida e leva até a coisa (a tarefa, a
 * conversa). No hover: marcar como lida/não lida e tirar da lista. Chegou
 * notificação com a tela aberta, ela relê sozinha (o notificador do shell
 * avisa).
 */

const KIND_ICON: Record<NotificationKind, (p: { size?: number; className?: string }) => React.ReactNode> = {
  mencao: AtSignIcon,
  atribuicao: UserPenIcon,
  comentario: MessageCircleIcon,
  mensagem: MessageSquareIcon,
};

export function NotificationsView({ initial }: { initial: AppNotification[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<NotificationTab>("todas");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/notificacoes", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: AppNotification[] };
      setItems(data.notifications);
    } catch {
      // Sem rede: fica o que já está na tela.
    }
  }, []);

  useEffect(() => {
    const onChanged = () => void reload();
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [reload]);

  const visible = useMemo(() => items.filter((n) => inTab(n, tab)), [items, tab]);
  const days = useMemo(() => groupNotificationsByDay(visible), [visible]);
  const unread = unreadTotal(items);

  async function mark(which: { ids?: string[]; all?: boolean }, read: boolean) {
    const before = items;
    const ids = new Set(which.ids ?? []);
    const at = new Date().toISOString();
    setItems((list) =>
      list.map((n) => (which.all || ids.has(n.id) ? { ...n, readAt: read ? (n.readAt ?? at) : null } : n)),
    );
    try {
      const res = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...which, read }),
      });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setItems(before);
      toast("Não deu para marcar. Tente de novo.", "error");
    }
  }

  async function remove(id: string) {
    const before = items;
    setItems((list) => list.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/notificacoes/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setItems(before);
      toast("Não deu para remover. Tente de novo.", "error");
    }
  }

  function open(n: AppNotification) {
    if (!n.readAt) void mark({ ids: [n.id] }, true);
    router.push(n.href);
  }

  const counts: Record<NotificationTab, number | undefined> = {
    todas: undefined,
    "nao-lidas": unread,
    mencoes: items.filter((n) => n.kind === "mencao" && !n.readAt).length || undefined,
    atribuicoes: items.filter((n) => n.kind === "atribuicao" && !n.readAt).length || undefined,
  };

  return (
    <Screen>
      <Breadcrumb items={[{ label: "black berry", href: "/tarefas" }, { label: "Notificações" }]} />

      <ScreenHeader
        actions={
          <ScreenAction onClick={() => void mark({ all: true }, true)} disabled={unread === 0} className="disabled:opacity-40">
            <CheckIcon size={14} className="mr-2" />
            <span className="hidden sm:inline">Marcar todas como lidas</span>
            <span className="sm:hidden">Ler todas</span>
          </ScreenAction>
        }
      >
        <TabStrip
          tabs={NOTIFICATION_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
          active={tab}
          onSelect={(id) => setTab(id as NotificationTab)}
        />
      </ScreenHeader>

      <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2">
        {days.length === 0 && (
          <div className="m-auto flex max-w-[300px] flex-col items-center gap-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-border text-fg-3">
              <BellIcon size={18} />
            </span>
            <p className="text-[13px] leading-[19px] text-muted">
              {tab === "nao-lidas"
                ? "Tudo lido por aqui."
                : tab === "mencoes"
                  ? "Ninguém te marcou ainda. Quando alguém escrever o seu @ numa tarefa, comentário ou mensagem, aparece aqui."
                  : tab === "atribuicoes"
                    ? "Nenhuma tarefa chegou para você ainda."
                    : "Nada por aqui ainda. Menções, tarefas que chegam para você e mensagens novas aparecem nesta tela."}
            </p>
          </div>
        )}

        {days.map((day) => (
          <section key={day.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-3 pb-1">
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.6px] text-muted">{day.label}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {day.items.map((n, i) => (
              <Row
                key={n.id}
                n={n}
                index={i}
                onOpen={() => open(n)}
                onToggleRead={() => void mark({ ids: [n.id] }, !n.readAt)}
                onRemove={() => void remove(n.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </Screen>
  );
}

function Row({
  n,
  index,
  onOpen,
  onToggleRead,
  onRemove,
}: {
  n: AppNotification;
  index: number;
  onOpen: () => void;
  onToggleRead: () => void;
  onRemove: () => void;
}) {
  const Icon = KIND_ICON[n.kind];
  const unread = !n.readAt;
  const extra = countLabel(n);
  return (
    <div
      style={{ ["--d" as string]: index }}
      className={cn(
        "stagger-item group relative flex items-start gap-3 rounded-chip px-3 py-2.5 transition-colors",
        unread ? "bg-surface-2/60 hover:bg-surface-2" : "hover:bg-surface-2/60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-chip focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
        aria-label={`${n.title}${unread ? " (não lida)" : ""}`}
      />
      <span className="relative mt-0.5 h-9 w-9 shrink-0" aria-hidden="true">
        <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-border text-[12px] font-semibold text-fg-3">
          {n.actor === SYSTEM_ACTOR ? <GitBranchIcon size={15} /> : initialsOf(n.actor)}
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-pill bg-surface text-fg-3 outline-2 outline-surface">
          <Icon size={11} />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[13px] leading-[18px]", unread ? "font-semibold text-fg" : "font-medium text-fg-soft")}>
          {n.title}
        </span>
        {n.body && <span className="line-clamp-2 text-[12px] leading-[17px] text-fg-3">{n.body}</span>}
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          {messageTime(n.createdAt)}
          <span aria-hidden="true">·</span>
          {KIND_LABEL[n.kind]}
          {extra && (
            <>
              <span aria-hidden="true">·</span>
              {extra}
            </>
          )}
        </span>
      </span>

      <span className="relative z-10 flex shrink-0 items-center gap-1">
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
          <IconButton label={unread ? "Marcar como lida" : "Marcar como não lida"} onClick={onToggleRead}>
            {unread ? <CheckIcon size={14} /> : <BellIcon size={14} />}
          </IconButton>
          <IconButton label="Tirar da lista" onClick={onRemove}>
            <XIcon size={14} />
          </IconButton>
        </span>
        {unread && <span className="ml-1 h-2 w-2 rounded-full bg-fg" aria-hidden="true" />}
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="tap flex h-7 w-7 items-center justify-center rounded-mark text-fg-3 transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}

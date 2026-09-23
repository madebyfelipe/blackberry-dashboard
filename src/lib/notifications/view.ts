import { dayKey, dayLabel } from "@/lib/inbox/view";
import type { AppNotification, NotificationInput, NotificationKind } from "./types";

/*
 * A régua das notificações — funções puras, testadas em
 * `tests/notifications-view.test.ts`. O repositório só grava o que sai daqui:
 * como mensagens da mesma conversa se juntam, quantas ficam guardadas por
 * pessoa e o que cada aba da tela mostra.
 */

/** Quantas notificações ficam guardadas por pessoa. As lidas mais velhas saem primeiro. */
export const KEEP_PER_RECIPIENT = 200;

/** O trecho do que foi escrito que cabe na notificação. */
export const BODY_MAX = 160;

export const KIND_LABEL: Record<NotificationKind, string> = {
  mencao: "Menção",
  atribuicao: "Atribuição",
  comentario: "Comentário",
  mensagem: "Mensagem",
};

export function isNotificationKind(v: unknown): v is NotificationKind {
  return v === "mencao" || v === "atribuicao" || v === "comentario" || v === "mensagem";
}

/** Uma linha só, sem markdown pesado, no tamanho do trecho. */
export function excerpt(text: string, max = BODY_MAX): string {
  const flat = String(text ?? "")
    .replace(/[*_`>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Junta uma notificação nova à lista de uma pessoa.
 *
 * Mensagem nova numa conversa que já tem aviso **não lido** não vira outra
 * linha: a que existe sobe para o topo, com o trecho da última e o contador
 * somado ("3 mensagens novas"). Uma conversa animada não enterra a menção
 * que importa embaixo de vinte avisos iguais.
 *
 * Devolve a lista nova (a mais recente primeiro) e a notificação que ficou.
 */
export function mergeNotification(
  list: AppNotification[],
  input: NotificationInput & { id: string; agencyId: AppNotification["agencyId"] },
  now: string,
): { list: AppNotification[]; notification: AppNotification } {
  if (input.kind === "mensagem") {
    const open = list.find(
      (n) =>
        n.kind === "mensagem" &&
        n.recipientId === input.recipientId &&
        n.ref === input.ref &&
        !n.readAt,
    );
    if (open) {
      const merged: AppNotification = {
        ...open,
        actor: input.actor,
        title: input.title,
        body: input.body,
        count: open.count + 1,
        createdAt: now,
      };
      return { list: [merged, ...list.filter((n) => n.id !== open.id)], notification: merged };
    }
  }
  const created: AppNotification = { ...input, count: 1, createdAt: now, readAt: null };
  return { list: [created, ...list], notification: created };
}

/**
 * Corta o que passa do teto, por pessoa. Sai primeiro a lida mais velha;
 * não lida só sai se a pessoa tiver mais de `keep` não lidas.
 */
export function trimPerRecipient(list: AppNotification[], keep = KEEP_PER_RECIPIENT): AppNotification[] {
  const byRecipient = new Map<string, AppNotification[]>();
  for (const n of list) {
    const key = `${n.agencyId}|${n.recipientId}`;
    byRecipient.set(key, [...(byRecipient.get(key) ?? []), n]);
  }
  const drop = new Set<string>();
  for (const items of byRecipient.values()) {
    if (items.length <= keep) continue;
    const ordered = [...items].sort((a, b) => {
      // Não lida fica; entre iguais, a mais nova fica.
      if (!a.readAt !== !b.readAt) return a.readAt ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    for (const n of ordered.slice(keep)) drop.add(n.id);
  }
  return drop.size ? list.filter((n) => !drop.has(n.id)) : list;
}

export type NotificationTab = "todas" | "nao-lidas" | "mencoes" | "atribuicoes";

export const NOTIFICATION_TABS: { id: NotificationTab; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "nao-lidas", label: "Não lidas" },
  { id: "mencoes", label: "Menções" },
  { id: "atribuicoes", label: "Atribuições" },
];

export function inTab(n: AppNotification, tab: NotificationTab): boolean {
  if (tab === "nao-lidas") return !n.readAt;
  if (tab === "mencoes") return n.kind === "mencao";
  if (tab === "atribuicoes") return n.kind === "atribuicao";
  return true;
}

export function unreadTotal(list: AppNotification[]): number {
  return list.filter((n) => !n.readAt).length;
}

export type NotificationDay = { key: string; label: string; items: AppNotification[] };

/** Em blocos de dia ("HOJE", "ONTEM", "SEGUNDA, 21 DE SETEMBRO"), a mais nova primeiro. */
export function groupNotificationsByDay(
  list: AppNotification[],
  now = Date.now(),
): NotificationDay[] {
  const out: NotificationDay[] = [];
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const n of sorted) {
    const key = dayKey(n.createdAt);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(n);
    else out.push({ key, label: dayLabel(n.createdAt, now), items: [n] });
  }
  return out;
}

/** "3 mensagens novas" — a linha extra do aviso que junta mensagens. */
export function countLabel(n: AppNotification): string {
  return n.kind === "mensagem" && n.count > 1 ? `${n.count} mensagens novas` : "";
}

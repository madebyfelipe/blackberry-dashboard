import type { AgencyScope } from "@/lib/agency/types";
import { read, transaction } from "./store";
import type { AppNotification, NotificationInput } from "./types";
import { mergeNotification, trimPerRecipient } from "./view";

/*
 * Tudo que o app lê e grava de notificação passa por aqui. Mesmo
 * multi-tenant das outras áreas — `AgencyScope` primeiro, vindo só da sessão
 * — e uma segunda fronteira, como no Inbox: a notificação é de uma pessoa, e
 * só ela lê ou marca a sua.
 */

function makeId(): string {
  return "n" + Math.random().toString(36).slice(2, 10);
}

/** As suas, da mais nova para a mais velha. */
export async function listNotifications(
  scope: AgencyScope,
  recipientId: string,
  limit = 100,
): Promise<AppNotification[]> {
  return (await read())
    .filter((n) => n.agencyId === scope.agencyId && n.recipientId === recipientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function unreadNotifications(scope: AgencyScope, recipientId: string): Promise<number> {
  return (await read()).filter(
    (n) => n.agencyId === scope.agencyId && n.recipientId === recipientId && !n.readAt,
  ).length;
}

/**
 * Grava os avisos (vários destinatários de uma vez, numa transação só) e
 * devolve cada notificação como ficou — a nova ou a de mensagem que somou.
 */
export async function pushNotifications(
  scope: AgencyScope,
  inputs: NotificationInput[],
): Promise<AppNotification[]> {
  if (inputs.length === 0) return [];
  return transaction((list) => {
    let next = list;
    const out: AppNotification[] = [];
    const now = new Date().toISOString();
    for (const input of inputs) {
      const merged = mergeNotification(next, { ...input, id: makeId(), agencyId: scope.agencyId }, now);
      next = merged.list;
      out.push(merged.notification);
    }
    next = trimPerRecipient(next);
    list.splice(0, list.length, ...next);
    return structuredClone(out);
  });
}

/**
 * Marca como lidas (ou não lidas). `ids` vazio com `all` marca todas as
 * suas; `ref` marca as de uma tarefa/conversa (abrir a coisa é ler o aviso).
 */
export async function markNotifications(
  scope: AgencyScope,
  recipientId: string,
  which: { ids?: string[]; all?: boolean; ref?: string },
  asRead = true,
): Promise<number> {
  const ids = new Set(which.ids ?? []);
  const hits = (n: AppNotification) =>
    n.agencyId === scope.agencyId &&
    n.recipientId === recipientId &&
    (which.all || ids.has(n.id) || (!!which.ref && n.ref === which.ref)) &&
    !!n.readAt !== asRead;
  // Abrir uma tarefa ou conversa chama isto a cada vez: sem nada a mudar, sem gravação.
  if (!(await read()).some(hits)) return 0;
  return transaction((list) => {
    const at = new Date().toISOString();
    let changed = 0;
    for (const n of list) {
      if (!hits(n)) continue;
      n.readAt = asRead ? at : null;
      changed++;
    }
    return changed;
  });
}

/** Tira uma notificação da lista (o "remover" da tela). */
export async function deleteNotification(
  scope: AgencyScope,
  recipientId: string,
  id: string,
): Promise<boolean> {
  return transaction((list) => {
    const i = list.findIndex(
      (n) => n.id === id && n.agencyId === scope.agencyId && n.recipientId === recipientId,
    );
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  });
}

/**
 * A mensagem mudou: o aviso que mostrava o texto dela acompanha — editada,
 * o trecho novo; apagada, "Mensagem apagada". Casa pelo id da mensagem, na
 * agência: nunca pelo texto (que repete, e que a edição já trocou).
 */
export async function updateMessageNotifications(
  scope: AgencyScope,
  messageId: string,
  body: string,
): Promise<number> {
  const hit = (n: AppNotification) =>
    n.agencyId === scope.agencyId && n.messageId === messageId && n.body !== body;
  if (!messageId || !(await read()).some(hit)) return 0;
  return transaction((list) => {
    let changed = 0;
    for (const n of list) {
      if (!hit(n)) continue;
      n.body = body;
      changed++;
    }
    return changed;
  });
}

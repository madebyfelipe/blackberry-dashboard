import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import type { AppNotification } from "./types";
import { isNotificationKind } from "./view";

/*
 * Armazenamento das notificações. Mesma cadeia das outras áreas: a tela fala
 * com `repository.ts`, que fala só com este arquivo, e `lib/store/index.ts`
 * decide entre Postgres e arquivo JSON.
 */

function normalize(raw: Partial<AppNotification> & { id: string }): AppNotification | null {
  if (!isNotificationKind(raw.kind) || !raw.recipientId) return null;
  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
    recipientId: String(raw.recipientId),
    kind: raw.kind,
    actor: String(raw.actor ?? ""),
    title: String(raw.title ?? ""),
    body: String(raw.body ?? ""),
    // Só caminho do próprio app: o clique numa notificação nunca sai do produto.
    href: typeof raw.href === "string" && raw.href.startsWith("/") && !raw.href.startsWith("//") ? raw.href : "/notificacoes",
    ref: String(raw.ref ?? ""),
    ...(typeof raw.messageId === "string" && raw.messageId ? { messageId: raw.messageId } : {}),
    count: Number.isFinite(raw.count) && (raw.count as number) > 0 ? Math.floor(raw.count as number) : 1,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    readAt: typeof raw.readAt === "string" && raw.readAt ? raw.readAt : null,
  };
}

const store = createStore<AppNotification[]>({
  file: "notifications.json",
  seed: () => [],
  revive: (raw) =>
    (Array.isArray(raw) ? raw : [])
      .filter((n): n is AppNotification => !!n && typeof n === "object" && !!(n as AppNotification).id)
      .map(normalize)
      .filter((n): n is AppNotification => !!n),
});

export const read = store.read;
export const transaction = store.transaction;

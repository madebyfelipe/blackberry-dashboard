import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import { isPresence } from "./constants";
import { seedInbox } from "./seed";
import type { Conversation, InboxData, InboxMember, Message } from "./types";

/*
 * Armazenamento do Inbox. Mesma cadeia das outras áreas: a tela fala com
 * `repository.ts`, que fala só com este arquivo, e `lib/store/index.ts`
 * decide entre Postgres e arquivo JSON por `DATABASE_URL`.
 *
 * O arquivo guarda os dois lados da mesma coisa — a equipe e as conversas
 * dela. Ficam juntos porque a conversa não faz sentido sem saber quem é quem,
 * e porque equipe ainda não é entidade própria do produto (`/equipe` é
 * placeholder): quando ela nascer, `members` sai daqui sem mexer na view.
 */

function normalizeMember(raw: Partial<InboxMember> & { id: string }): InboxMember {
  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
    name: String(raw.name ?? "").trim() || "—",
    email: String(raw.email ?? "").trim().toLowerCase(),
    presence: isPresence(raw.presence) ? raw.presence : "offline",
  };
}

function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Message>;
  const id = String(m.id ?? "");
  const text = String(m.text ?? "");
  if (!id || !text) return null;
  return {
    id,
    authorId: String(m.authorId ?? ""),
    text,
    createdAt: String(m.createdAt ?? new Date().toISOString()),
    kind: m.kind === "chamada" || m.kind === "aviso" ? m.kind : "texto",
  };
}

/** Só o que é string de verdade vira marca de leitura — o resto é ruído. */
function normalizeReadAt(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value) out[id] = value;
  }
  return out;
}

/**
 * Uma chamada que ninguém encerrou.
 *
 * Quem sai avisa o servidor, mas navegador que fecha sozinho (queda de luz,
 * aba morta) não avisa nada — e o registro ficaria dizendo "chamada em
 * andamento" para sempre. Passado este tempo, a leitura considera encerrada:
 * é a mesma ideia do `revive` dos outros stores, corrigindo na leitura em vez
 * de depender de alguém ter feito a coisa certa na escrita.
 */
const CALL_STALE_MS = 4 * 60 * 60 * 1000;

function normalizeCall(raw: unknown): Conversation["call"] {
  if (!raw || typeof raw !== "object") return null;
  const call = raw as Partial<NonNullable<Conversation["call"]>>;
  const memberIds = Array.isArray(call.memberIds)
    ? call.memberIds.map(String).filter(Boolean)
    : [];
  const startedAt = String(call.startedAt ?? "");
  const started = Date.parse(startedAt);
  if (memberIds.length === 0 || Number.isNaN(started)) return null;
  if (Date.now() - started > CALL_STALE_MS) return null;
  return { startedBy: String(call.startedBy ?? memberIds[0]), startedAt, memberIds };
}

function normalizeConversation(
  raw: Partial<Conversation> & { id: string },
): Conversation {
  const messages = (Array.isArray(raw.messages) ? raw.messages : [])
    .map(normalizeMessage)
    .filter((m): m is Message => !!m)
    // O histórico é lido de trás para frente o tempo todo; ordenar na leitura
    // evita que uma gravação fora de ordem apareça embaralhada na tela.
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
    kind: raw.kind === "direta" ? "direta" : "grupo",
    name: String(raw.name ?? ""),
    memberIds: Array.isArray(raw.memberIds)
      ? raw.memberIds.map(String).filter(Boolean)
      : [],
    messages,
    mutedBy: Array.isArray(raw.mutedBy) ? raw.mutedBy.map(String) : [],
    readAt: normalizeReadAt(raw.readAt),
    call: normalizeCall(raw.call),
    createdAt: String(raw.createdAt ?? messages[0]?.createdAt ?? new Date().toISOString()),
  };
}

/**
 * Migração de leitura, como nos outros stores: arquivo gravado antes de um
 * campo continua válido, e o que faltar entra com o padrão. Arquivo de uma
 * versão em que o Inbox ainda não existia simplesmente não tem este arquivo —
 * quem semeia é o `seed`.
 */
function revive(raw: unknown): InboxData {
  const data = (raw ?? {}) as Partial<InboxData>;
  return {
    members: (Array.isArray(data.members) ? data.members : [])
      .filter((m): m is InboxMember => !!m && typeof m === "object" && !!m.id)
      .map(normalizeMember),
    conversations: (Array.isArray(data.conversations) ? data.conversations : [])
      .filter((c): c is Conversation => !!c && typeof c === "object" && !!c.id)
      .map(normalizeConversation),
  };
}

const store = createStore<InboxData>({
  file: "inbox.json",
  seed: seedInbox,
  revive,
});

export const read = store.read;
export const transaction = store.transaction;

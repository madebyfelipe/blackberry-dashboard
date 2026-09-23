import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import { isPresence } from "./constants";
import { handleProblem, normalizeHandle, suggestHandle } from "./handle";
import { isMemberRole, isMemberStatus } from "./users";
import { normalizeDomain } from "./domain";
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
    handle: normalizeHandle(String(raw.handle ?? "")),
    // Gravado antes da tela de Usuários: quem já estava no time está ativo, e
    // a função padrão é editor — quem administra é promovido na tela.
    role: isMemberRole(raw.role) ? raw.role : "editor",
    status: isMemberStatus(raw.status) ? raw.status : "ativo",
    lastSeenAt: typeof raw.lastSeenAt === "string" && raw.lastSeenAt ? raw.lastSeenAt : null,
    createdAt: typeof raw.createdAt === "string" && raw.createdAt ? raw.createdAt : "2026-09-01T09:00:00.000Z",
    invite:
      raw.invite && typeof raw.invite === "object" && raw.invite.token
        ? {
            token: String(raw.invite.token),
            agencyName: String(raw.invite.agencyName ?? ""),
            invitedBy: String(raw.invite.invitedBy ?? ""),
          }
        : null,
    joinRequest: raw.joinRequest === true,
  };
}

/**
 * Todo mundo sai daqui com um @ válido e único na agência. Quem foi gravado
 * antes do @ existir (ou com um repetido) ganha o sugerido pelo nome; quem
 * chegou primeiro fica com o dele.
 */
function settleHandles(members: InboxMember[]): InboxMember[] {
  const taken = new Map<string, Set<string>>();
  return members.map((m) => {
    const used = taken.get(m.agencyId) ?? new Set<string>();
    taken.set(m.agencyId, used);
    const handle =
      !handleProblem(m.handle) && !used.has(m.handle)
        ? m.handle
        : suggestHandle(m.name, used);
    used.add(handle);
    return handle === m.handle ? m : { ...m, handle };
  });
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
 * A chamada em curso, como está gravada. Quem sumiu sem se despedir não é
 * decidido aqui, e sim em `call.ts`: lá a chamada fecha com a linha no
 * histórico, e aqui ela só seria apagada calada.
 */
function normalizeCall(raw: unknown): Conversation["call"] {
  if (!raw || typeof raw !== "object") return null;
  const call = raw as Partial<NonNullable<Conversation["call"]>>;
  const memberIds = Array.isArray(call.memberIds)
    ? call.memberIds.map(String).filter(Boolean)
    : [];
  const startedAt = String(call.startedAt ?? "");
  const started = Date.parse(startedAt);
  if (memberIds.length === 0 || Number.isNaN(started)) return null;
  // Gravação de antes do sinal de vida: sem `seenAt`, conta desde o início.
  return {
    startedBy: String(call.startedBy ?? memberIds[0]),
    startedAt,
    memberIds,
    seenAt: normalizeReadAt(call.seenAt),
  };
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
 * Toda agência precisa de alguém que administre o time. Gravação de antes da
 * tela de Usuários não tem função nenhuma — todo mundo cairia em "editor" e a
 * agência ficaria sem quem convide ou arquive. Então, onde ninguém é Admin nem
 * Gerente, quem tem conta (e-mail) vira Admin. Membro sem conta (a equipe de
 * demonstração) continua editor.
 */
function settleAdmins(members: InboxMember[]): InboxMember[] {
  const managed = new Set(
    members.filter((m) => m.role === "admin" || m.role === "gerente").map((m) => m.agencyId),
  );
  return members.map((m) =>
    !managed.has(m.agencyId) && m.email && m.status === "ativo" ? { ...m, role: "admin" } : m,
  );
}

function normalizeSettings(raw: unknown): InboxData["settings"] {
  if (!raw || typeof raw !== "object") return {};
  const out: InboxData["settings"] = {};
  for (const [agencyId, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = (value ?? {}) as { domain?: unknown; domainRole?: unknown };
    const domain = typeof v.domain === "string" ? normalizeDomain(v.domain) : "";
    out[agencyId] = {
      domain: domain || null,
      domainRole: isMemberRole(v.domainRole) ? v.domainRole : "editor",
    };
  }
  return out;
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
    members: settleAdmins(settleHandles(
      (Array.isArray(data.members) ? data.members : [])
        .filter((m): m is InboxMember => !!m && typeof m === "object" && !!m.id)
        .map(normalizeMember),
    )),
    conversations: (Array.isArray(data.conversations) ? data.conversations : [])
      .filter((c): c is Conversation => !!c && typeof c === "object" && !!c.id)
      .map(normalizeConversation),
    settings: normalizeSettings(data.settings),
  };
}

const store = createStore<InboxData>({
  file: "inbox.json",
  seed: seedInbox,
  revive,
});

export const read = store.read;
export const transaction = store.transaction;

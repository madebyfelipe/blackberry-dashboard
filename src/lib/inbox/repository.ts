import type { AgencyScope } from "@/lib/agency/types";
import { MESSAGE_MAX, isPresence } from "./constants";
import { read, transaction } from "./store";
import type {
  Conversation,
  ConversationDetail,
  ConversationSummary,
  InboxData,
  InboxMember,
  Message,
  Presence,
} from "./types";
import { callSummary, memberName, summarize } from "./view";

/*
 * Tudo que o app lê e grava do Inbox passa por aqui.
 *
 * O multi-tenant é o mesmo das outras áreas: `AgencyScope` como primeiro
 * argumento, vindo só da sessão do servidor, e conversa de outra agência
 * responde como conversa inexistente (404, nunca 403).
 *
 * Só que conversa tem **uma segunda fronteira**: estar na agência não basta,
 * é preciso estar na conversa. Toda função procura por id, agência *e*
 * participante — quem não é do grupo não lê o grupo, mesmo sendo da casa.
 */

export class ValidationError extends Error {}

function membersOf(data: InboxData, scope: AgencyScope): InboxMember[] {
  return data.members.filter((m) => m.agencyId === scope.agencyId);
}

/** A conversa de quem pede: da agência dele e com ele dentro. */
function find(
  data: InboxData,
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Conversation | undefined {
  return data.conversations.find(
    (c) =>
      c.id === id &&
      c.agencyId === scope.agencyId &&
      c.memberIds.includes(viewerId),
  );
}

function detail(
  conversation: Conversation,
  members: InboxMember[],
  viewerId: string,
): ConversationDetail {
  return structuredClone({
    ...summarize(conversation, members, viewerId),
    messages: conversation.messages,
    members: conversation.memberIds
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is InboxMember => !!m),
  });
}

function makeId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}

/* ------------------------------------------------------------------ equipe */

/** "felipe@blackberry.app" → "m-felipe-blackberry-app". */
function memberIdFromEmail(email: string): string {
  const slug = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `m-${slug || "pessoa"}`;
}

/**
 * Quem está olhando a tela, como membro da equipe.
 *
 * Enquanto não existir convite de equipe (ver `agency/id.ts`), é esta função
 * que povoa a agência: quem entra no app pela primeira vez vira membro. O
 * vínculo é pelo e-mail da conta — é o que liga a conta de demonstração ao
 * "Felipe" do seed em vez de criar um segundo Felipe ao lado dele.
 */
export async function ensureMember(
  scope: AgencyScope,
  user: { name: string; email: string },
): Promise<InboxMember> {
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim() || "—";

  const existing = membersOf(await read(), scope).find((m) => m.email === email);
  // Caminho comum: já existe e está em dia — nenhuma gravação por page load.
  if (existing && existing.name === name) return existing;

  return transaction((data) => {
    const members = membersOf(data, scope);
    const member = members.find((m) => m.email === email);
    if (member) {
      // A pessoa trocou o nome em Configurações: a conversa acompanha.
      member.name = name;
      return { ...member };
    }
    let id = memberIdFromEmail(email);
    while (data.members.some((m) => m.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    const created: InboxMember = {
      id,
      agencyId: scope.agencyId,
      name,
      email,
      presence: "disponivel",
    };
    data.members.push(created);
    return { ...created };
  });
}

export async function listMembers(scope: AgencyScope): Promise<InboxMember[]> {
  return membersOf(await read(), scope).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

export async function setPresence(
  scope: AgencyScope,
  viewerId: string,
  presence: Presence,
): Promise<InboxMember | undefined> {
  if (!isPresence(presence)) throw new ValidationError("Status inválido.");
  return transaction((data) => {
    const member = data.members.find(
      (m) => m.id === viewerId && m.agencyId === scope.agencyId,
    );
    if (!member) return undefined;
    member.presence = presence;
    return { ...member };
  });
}

/* ------------------------------------------------------------- conversas */

export async function listConversations(
  scope: AgencyScope,
  viewerId: string,
): Promise<ConversationSummary[]> {
  const data = await read();
  const members = membersOf(data, scope);
  return data.conversations
    .filter(
      (c) => c.agencyId === scope.agencyId && c.memberIds.includes(viewerId),
    )
    .map((c) => summarize(c, members, viewerId));
}

export async function getConversation(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<ConversationDetail | undefined> {
  const data = await read();
  const conversation = find(data, scope, viewerId, id);
  return conversation && detail(conversation, membersOf(data, scope), viewerId);
}

/**
 * Abre a direta com alguém do time — a mesma de sempre, se já existir. Duas
 * diretas com a mesma pessoa seriam duas metades do mesmo histórico.
 */
export async function openDirect(
  scope: AgencyScope,
  viewerId: string,
  otherId: string,
): Promise<ConversationDetail | undefined> {
  if (otherId === viewerId) {
    throw new ValidationError("Não dá para abrir uma conversa com você mesmo.");
  }
  return transaction((data) => {
    const members = membersOf(data, scope);
    const other = members.find((m) => m.id === otherId);
    const viewer = members.find((m) => m.id === viewerId);
    if (!other || !viewer) return undefined;

    const existing = data.conversations.find(
      (c) =>
        c.agencyId === scope.agencyId &&
        c.kind === "direta" &&
        c.memberIds.length === 2 &&
        c.memberIds.includes(viewerId) &&
        c.memberIds.includes(otherId),
    );
    if (existing) return detail(existing, members, viewerId);

    const created: Conversation = {
      id: makeId("d"),
      agencyId: scope.agencyId,
      kind: "direta",
      name: "",
      memberIds: [viewerId, otherId],
      messages: [],
      mutedBy: [],
      readAt: { [viewerId]: new Date().toISOString() },
      call: null,
      createdAt: new Date().toISOString(),
    };
    data.conversations.push(created);
    return detail(created, members, viewerId);
  });
}

function pushMessage(
  conversation: Conversation,
  authorId: string,
  text: string,
  kind: Message["kind"],
): Message {
  const message: Message = {
    id: makeId("m"),
    authorId,
    text,
    createdAt: new Date().toISOString(),
    kind,
  };
  conversation.messages.push(message);
  // Quem escreve já leu o que escreveu.
  conversation.readAt[authorId] = message.createdAt;
  return message;
}

/**
 * Manda a mensagem. O autor é quem chama (a sessão do servidor), nunca o
 * corpo da requisição — mesma regra do comentário da tarefa.
 */
export async function sendMessage(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  text: string,
): Promise<ConversationDetail | undefined> {
  const clean = (text ?? "").trim();
  if (!clean) throw new ValidationError("Mensagem vazia.");
  if (clean.length > MESSAGE_MAX) {
    throw new ValidationError("Mensagem longa demais.");
  }
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    pushMessage(conversation, viewerId, clean, "texto");
    return detail(conversation, membersOf(data, scope), viewerId);
  });
}

/** Teto do que uma chamada registra — 8h é jornada, não conversa. */
const CALL_MAX_SECONDS = 8 * 60 * 60;

/**
 * Registra no histórico a chamada que acabou de acontecer — a linha de
 * sistema do export ("Marina iniciou uma chamada que durou 12 minutos").
 *
 * A duração vem de quem estava na chamada porque é o único lugar que sabe: a
 * chamada em si vive no navegador enquanto não existir camada de tempo real
 * (ver `components/inbox/CallOverlay.tsx`). Por isso ela é validada aqui e o
 * texto é montado aqui — não chega pronto de fora.
 */
export async function registerCall(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  seconds: number,
): Promise<ConversationDetail | undefined> {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ValidationError("Duração inválida.");
  }
  const duration = Math.min(Math.round(seconds), CALL_MAX_SECONDS);
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const members = membersOf(data, scope);
    pushMessage(
      conversation,
      viewerId,
      callSummary(memberName(members, viewerId), duration),
      "chamada",
    );
    return detail(conversation, members, viewerId);
  });
}

/**
 * Entra na chamada da conversa — e abre uma, se ainda não houver.
 *
 * Quem abriu fica registrado porque é o nome que vai para o histórico
 * quando a chamada acabar ("Fulano iniciou uma chamada que durou 12
 * minutos", a linha do export). Entrar duas vezes não duplica ninguém: a
 * mesma pessoa em duas abas é uma pessoa só na sala.
 */
export async function joinCall(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<ConversationDetail | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const now = new Date().toISOString();
    if (!conversation.call) {
      conversation.call = { startedBy: viewerId, startedAt: now, memberIds: [viewerId] };
    } else if (!conversation.call.memberIds.includes(viewerId)) {
      conversation.call.memberIds.push(viewerId);
    }
    return detail(conversation, membersOf(data, scope), viewerId);
  });
}

/**
 * Sai da chamada. A **última** pessoa a sair fecha a chamada e deixa a linha
 * no histórico, com o nome de quem começou e o tempo que ela durou de ponta
 * a ponta — não o tempo que cada um ficou. É uma chamada só, e o histórico
 * conta uma coisa só.
 */
export async function leaveCall(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<ConversationDetail | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const members = membersOf(data, scope);
    const call = conversation.call;
    if (!call) return detail(conversation, members, viewerId);

    call.memberIds = call.memberIds.filter((m) => m !== viewerId);
    if (call.memberIds.length === 0) {
      const seconds = Math.max(
        0,
        Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000),
      );
      conversation.call = null;
      pushMessage(
        conversation,
        call.startedBy,
        callSummary(memberName(members, call.startedBy), Math.min(seconds, CALL_MAX_SECONDS)),
        "chamada",
      );
      // Quem fechou a chamada acabou de ler a linha que ele mesmo gerou.
      conversation.readAt[viewerId] = new Date().toISOString();
    }
    return detail(conversation, members, viewerId);
  });
}

/**
 * Marca a conversa como lida (ou devolve para não lida, o "marcar como não
 * lida" do menu). Voltar atrás é recuar a marca para antes da última mensagem
 * de outra pessoa — é o que faz o badge reaparecer com a contagem certa.
 */
export async function setRead(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  value: boolean,
): Promise<ConversationSummary | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;

    if (value) {
      conversation.readAt[viewerId] = new Date().toISOString();
    } else {
      const last = [...conversation.messages]
        .reverse()
        .find((m) => m.kind === "texto" && m.authorId !== viewerId);
      if (last) {
        conversation.readAt[viewerId] = new Date(
          new Date(last.createdAt).getTime() - 1,
        ).toISOString();
      }
    }
    return summarize(conversation, membersOf(data, scope), viewerId);
  });
}

/** Silencia (ou desilencia) a conversa para quem pediu — só para ele. */
export async function setMuted(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  muted: boolean,
): Promise<ConversationSummary | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const has = conversation.mutedBy.includes(viewerId);
    if (muted && !has) conversation.mutedBy.push(viewerId);
    if (!muted && has) {
      conversation.mutedBy = conversation.mutedBy.filter((m) => m !== viewerId);
    }
    return summarize(conversation, membersOf(data, scope), viewerId);
  });
}

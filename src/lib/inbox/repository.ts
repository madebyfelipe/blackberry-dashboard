import type { AgencyScope } from "@/lib/agency/types";
import { ATTACHMENTS_MAX, MESSAGE_MAX, canChangeMessage, isPresence } from "./constants";
import { handleProblem, normalizeHandle, suggestHandle } from "./handle";
import { canManageTeam, isMemberRole, isMemberStatus } from "./users";
import { domainProblem, emailDomain, normalizeDomain } from "./domain";
import { read, transaction } from "./store";
import type {
  Attachment,
  Conversation,
  ConversationDetail,
  ConversationSummary,
  InboxData,
  InboxMember,
  MemberRole,
  MemberStatus,
  Message,
  TeamSettings,
  Presence,
} from "./types";
import {
  CALL_MAX_SECONDS,
  joinedCall,
  leftCall,
  settleCall,
  type Settled,
} from "./call";
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
  const now = Date.now();

  const existing = membersOf(await read(), scope).find((m) => m.email === email);
  // Caminho comum: já existe, está em dia e o último acesso é recente — nenhuma
  // gravação por carregamento de tela.
  if (
    existing &&
    existing.name === name &&
    existing.status !== "convite" &&
    existing.lastSeenAt &&
    now - Date.parse(existing.lastSeenAt) < LAST_SEEN_EVERY_MS
  ) {
    return existing;
  }

  return transaction((data) => {
    const members = membersOf(data, scope);
    const member = members.find((m) => m.email === email);
    const stamp = new Date(now).toISOString();
    if (member) {
      // A pessoa trocou o nome em Configurações: a conversa acompanha.
      member.name = name;
      member.lastSeenAt = stamp;
      // O convite vira gente: a primeira entrada é o aceite. O pedido pelo
      // domínio, não — ele espera um Admin aprovar.
      if (member.status === "convite" && !member.joinRequest) {
        member.status = "ativo";
        member.invite = null;
      }
      return { ...member };
    }
    let id = memberIdFromEmail(email);
    while (data.members.some((m) => m.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    const created: InboxMember = {
      id,
      agencyId: scope.agencyId,
      name,
      email,
      handle: suggestHandle(name, members.map((m) => m.handle)),
      presence: "disponivel",
      // Quem abre a agência administra; quem chega depois sem convite, edita.
      role: members.length === 0 ? "admin" : "editor",
      status: "ativo",
      lastSeenAt: stamp,
      createdAt: stamp,
      invite: null,
      joinRequest: false,
    };
    data.members.push(created);
    return { ...created };
  });
}

/** De quanto em quanto tempo o "último acesso" é regravado. */
const LAST_SEEN_EVERY_MS = 5 * 60_000;

/* ------------------------------------------------------------ Usuários */

/** Quem pede não pode mexer no time — a regra não é da tela, é daqui. */
export class ForbiddenError extends Error {}

function assertManager(data: InboxData, scope: AgencyScope, viewerId: string) {
  const viewer = membersOf(data, scope).find((m) => m.id === viewerId);
  if (!viewer || !canManageTeam(viewer)) {
    throw new ForbiddenError("Só Admin e Gerente mexem no time.");
  }
}

function newInviteToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * "Adicionar usuário": a pessoa entra no time como convite pendente, com o
 * @ já reservado e um token para o link de cadastro. Ela vira ativa quando
 * cria a conta por esse link e entra pela primeira vez (`ensureMember`).
 */
export async function inviteMember(
  scope: AgencyScope,
  viewerId: string,
  input: { name: string; email: string; role: MemberRole },
): Promise<InboxMember> {
  const name = String(input.name ?? "").trim().slice(0, 60);
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!name) throw new ValidationError("Informe o nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("E-mail inválido.");
  if (!isMemberRole(input.role)) throw new ValidationError("Função inválida.");

  return transaction((data) => {
    assertManager(data, scope, viewerId);
    const members = membersOf(data, scope);
    if (members.some((m) => m.email === email)) {
      throw new ValidationError("Esse e-mail já está no time.");
    }
    const inviter = members.find((m) => m.id === viewerId);
    let id = memberIdFromEmail(email);
    while (data.members.some((m) => m.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    const created: InboxMember = {
      id,
      agencyId: scope.agencyId,
      name,
      email,
      handle: suggestHandle(name, members.map((m) => m.handle)),
      presence: "offline",
      role: input.role,
      status: "convite",
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
      invite: {
        token: newInviteToken(),
        agencyName: scope.agencyName,
        invitedBy: inviter?.name ?? "",
      },
      joinRequest: false,
    };
    data.members.push(created);
    return { ...created };
  });
}

export type MemberPatch = {
  name?: string;
  role?: MemberRole;
  status?: MemberStatus;
};

/**
 * Editar, arquivar, reativar. Duas travas que a tela não consegue furar:
 * ninguém tira de si mesmo a administração (a agência ficaria sem quem
 * administra), e convite pendente só sai do estado quando a pessoa entra.
 */
export async function updateMember(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  patch: MemberPatch,
): Promise<InboxMember | undefined> {
  if (patch.role !== undefined && !isMemberRole(patch.role)) throw new ValidationError("Função inválida.");
  if (patch.status !== undefined && !isMemberStatus(patch.status)) throw new ValidationError("Status inválido.");
  if (patch.name !== undefined && !String(patch.name).trim()) {
    throw new ValidationError("O nome não pode ficar vazio.");
  }

  return transaction((data) => {
    assertManager(data, scope, viewerId);
    const m = membersOf(data, scope).find((x) => x.id === id);
    if (!m) return undefined;
    if (id === viewerId && patch.status !== undefined && patch.status !== "ativo") {
      throw new ValidationError("Você não pode arquivar nem desativar a si mesmo.");
    }
    if (id === viewerId && patch.role !== undefined && !canManageTeam({ role: patch.role })) {
      throw new ValidationError("Você não pode tirar de si mesmo a administração do time.");
    }
    if (m.joinRequest && patch.status !== undefined) {
      // O pedido pelo domínio: aprovar (ativo) ou recusar (arquivado).
      if (patch.status !== "ativo" && patch.status !== "arquivado") {
        throw new ValidationError("Um pedido de entrada é aprovado ou recusado.");
      }
      m.status = patch.status;
      m.joinRequest = false;
      if (patch.status === "ativo") m.lastSeenAt = m.lastSeenAt ?? null;
    } else if (patch.status !== undefined && patch.status !== m.status) {
      if (m.status === "convite") {
        throw new ValidationError("Convite pendente vira ativo quando a pessoa cria a conta — ou é excluído.");
      }
      if (patch.status === "convite") {
        throw new ValidationError('Convite só nasce em "Adicionar usuário".');
      }
      m.status = patch.status;
    }
    if (patch.name !== undefined) m.name = String(patch.name).trim().slice(0, 60);
    if (patch.role !== undefined) m.role = patch.role;
    return { ...m };
  });
}

/**
 * Excluir só vale para convite que ninguém aceitou. Quem já trabalhou tem
 * mensagem, tarefa e histórico com o nome dele — tirar a pessoa apagaria o
 * rastro; para isso existe arquivar.
 */
export async function deleteMember(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<boolean> {
  return transaction((data) => {
    assertManager(data, scope, viewerId);
    const i = data.members.findIndex((m) => m.id === id && m.agencyId === scope.agencyId);
    if (i === -1) return false;
    if (data.members[i].status !== "convite") {
      throw new ValidationError("Só convite pendente pode ser excluído. Quem já trabalhou no time é arquivado.");
    }
    if (data.members[i].joinRequest) {
      // A conta já existe dentro da agência: sem o membro, ela entraria direto.
      throw new ValidationError("Pedido de entrada se recusa (fica arquivado) — não se exclui.");
    }
    data.members.splice(i, 1);
    return true;
  });
}

/** Troca o token do convite — o "Reenviar acesso" quando o link antigo se perdeu. */
export async function renewInvite(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<InboxMember | undefined> {
  return transaction((data) => {
    assertManager(data, scope, viewerId);
    const m = membersOf(data, scope).find((x) => x.id === id);
    if (!m) return undefined;
    if (m.status !== "convite" || !m.invite) {
      throw new ValidationError("Essa pessoa já tem conta — o acesso dela é o e-mail e a senha.");
    }
    m.invite = { ...m.invite, token: newInviteToken() };
    return { ...m };
  });
}

/* ------------------------------------------------ domínio e acesso */

const DEFAULT_SETTINGS: TeamSettings = { domain: null, domainRole: "editor" };

export async function getTeamSettings(scope: AgencyScope): Promise<TeamSettings> {
  return (await read()).settings[scope.agencyId] ?? DEFAULT_SETTINGS;
}

/**
 * Liga, troca ou desliga o domínio do convite automático. Só Admin e Gerente,
 * e só um domínio do próprio e-mail de quem configura (ver `domainProblem`).
 */
export async function setTeamDomain(
  scope: AgencyScope,
  viewerId: string,
  input: { domain: string | null; domainRole?: MemberRole },
): Promise<TeamSettings> {
  return transaction((data) => {
    assertManager(data, scope, viewerId);
    const viewer = membersOf(data, scope).find((m) => m.id === viewerId)!;
    const current = data.settings[scope.agencyId] ?? DEFAULT_SETTINGS;
    let domain: string | null = null;
    if (input.domain) {
      domain = normalizeDomain(input.domain);
      const problem = domainProblem(domain, viewer.email);
      if (problem) throw new ValidationError(problem);
      const taken = Object.entries(data.settings).some(
        ([agencyId, s]) => agencyId !== scope.agencyId && s.domain === domain,
      );
      if (taken) throw new ValidationError(`${domain} já é o domínio de outra agência.`);
    }
    const role = input.domainRole ?? current.domainRole;
    if (!isMemberRole(role)) throw new ValidationError("Função inválida.");
    const next: TeamSettings = { domain, domainRole: role };
    data.settings[scope.agencyId] = next;
    return { ...next };
  });
}

/**
 * A agência dona de um domínio — o cadastro sem convite usa isto para achar
 * o time de quem chega com e-mail da casa. Roda sem sessão, como `findInvite`.
 */
export async function agencyForEmail(
  email: string,
): Promise<{ agencyId: InboxMember["agencyId"]; agencyName: string } | undefined> {
  const domain = emailDomain(email);
  if (!domain) return undefined;
  const data = await read();
  const entry = Object.entries(data.settings).find(([, s]) => s.domain === domain);
  if (!entry) return undefined;
  const agencyId = entry[0] as InboxMember["agencyId"];
  // O nome da agência: o de qualquer convite gravado, ou o próprio id.
  const invite = data.members.find((m) => m.agencyId === agencyId && m.invite)?.invite;
  return { agencyId, agencyName: invite?.agencyName ?? "" };
}

/**
 * O pedido de entrada de quem se cadastrou com o domínio da agência: a
 * pessoa vira membro "convite pendente", marcada como pedido, com a função
 * padrão do domínio. Só enxerga a agência depois que alguém aprova.
 */
export async function requestJoin(
  agencyId: InboxMember["agencyId"],
  user: { name: string; email: string },
): Promise<InboxMember> {
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim() || "—";
  return transaction((data) => {
    const members = data.members.filter((m) => m.agencyId === agencyId);
    const existing = members.find((m) => m.email === email);
    if (existing) return { ...existing };
    let id = memberIdFromEmail(email);
    while (data.members.some((m) => m.id === id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    const created: InboxMember = {
      id,
      agencyId,
      name,
      email,
      handle: suggestHandle(name, members.map((m) => m.handle)),
      presence: "offline",
      role: data.settings[agencyId]?.domainRole ?? "editor",
      status: "convite",
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
      invite: null,
      joinRequest: true,
    };
    data.members.push(created);
    return { ...created };
  });
}

/**
 * Se a conta pode usar a agência agora. É a trava de `requireAgency`:
 * arquivado não entra mais (arquivar é tirar o acesso), e o pedido pelo
 * domínio espera aprovação. Quem ainda não é membro entra — é o primeiro
 * acesso, e `ensureMember` o registra.
 */
export async function memberAccess(
  agencyId: InboxMember["agencyId"],
  email: string,
): Promise<"ok" | "aguardando" | "bloqueado"> {
  const e = email.trim().toLowerCase();
  const m = (await read()).members.find((x) => x.agencyId === agencyId && x.email === e);
  if (!m) return "ok";
  if (m.status === "arquivado") return "bloqueado";
  if (m.joinRequest) return "aguardando";
  return "ok";
}

/**
 * O convite por trás de um link de cadastro. Roda **sem sessão** — quem
 * autoriza é o token, como no link público de aprovação —, então devolve só
 * o necessário para o cadastro: e-mail, nome, agência.
 */
export async function findInvite(token: string): Promise<
  { email: string; name: string; agencyId: InboxMember["agencyId"]; agencyName: string } | undefined
> {
  if (!/^[a-f0-9]{36}$/.test(token)) return undefined;
  const m = (await read()).members.find((x) => x.status === "convite" && x.invite?.token === token);
  if (!m || !m.invite) return undefined;
  return { email: m.email, name: m.name, agencyId: m.agencyId, agencyName: m.invite.agencyName };
}

/**
 * Troca o seu @. Só o seu — quem muda vem da sessão —, e ele continua único
 * na agência: um @ repetido faria a menção cair na pessoa errada.
 */
export async function setHandle(
  scope: AgencyScope,
  viewerId: string,
  raw: string,
): Promise<InboxMember | undefined> {
  const handle = normalizeHandle(String(raw ?? ""));
  const problem = handleProblem(handle);
  if (problem) throw new ValidationError(problem);
  return transaction((data) => {
    const members = membersOf(data, scope);
    const me = members.find((m) => m.id === viewerId);
    if (!me) return undefined;
    if (members.some((m) => m.id !== viewerId && m.handle === handle)) {
      throw new ValidationError(`@${handle} já é de outra pessoa do time.`);
    }
    me.handle = handle;
    return { ...me };
  });
}

/** Quem do time atende por este @ — `undefined` quando ninguém. */
export async function memberByHandle(
  scope: AgencyScope,
  raw: string,
): Promise<InboxMember | undefined> {
  const handle = normalizeHandle(raw);
  return membersOf(await read(), scope).find((m) => m.handle === handle);
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

/**
 * Aplica o resultado da régua de `call.ts` na conversa: grava a chamada que
 * sobrou e, se ela fechou, a linha do histórico.
 */
function applyCall(
  conversation: Conversation,
  members: InboxMember[],
  settled: Settled,
): void {
  conversation.call = settled.call;
  if (settled.ended) {
    const { startedBy, seconds } = settled.ended;
    const readBefore = conversation.readAt[startedBy];
    pushMessage(
      conversation,
      startedBy,
      callSummary(memberName(members, startedBy), seconds),
      "chamada",
    );
    /*
     * A linha é de sistema, e quem "assina" é quem começou a chamada — que
     * pode nem estar olhando (a chamada fechou porque todo mundo sumiu).
     * Ela não pode marcar como lido o que essa pessoa ainda não leu.
     */
    if (readBefore) conversation.readAt[startedBy] = readBefore;
    else delete conversation.readAt[startedBy];
  }
}

/**
 * Fecha as chamadas de quem sumiu sem se despedir, nas conversas desta
 * pessoa. Leitura comum não grava nada: só entra em transação quando há
 * chamada com alguém calado há tempo demais.
 */
async function settleStaleCalls(
  scope: AgencyScope,
  viewerId: string,
): Promise<InboxData> {
  const data = await read();
  const now = Date.now();
  const mine = (c: Conversation) =>
    c.agencyId === scope.agencyId && c.memberIds.includes(viewerId);
  const stale = data.conversations.some(
    (c) => mine(c) && settleCall(c.call, now).changed,
  );
  if (!stale) return data;
  return transaction((fresh) => {
    const members = membersOf(fresh, scope);
    const at = Date.now();
    for (const c of fresh.conversations) {
      if (!mine(c)) continue;
      const settled = settleCall(c.call, at);
      if (settled.changed) applyCall(c, members, settled);
    }
    return fresh;
  });
}

export async function listConversations(
  scope: AgencyScope,
  viewerId: string,
): Promise<ConversationSummary[]> {
  const data = await settleStaleCalls(scope, viewerId);
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
  const data = await settleStaleCalls(scope, viewerId);
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
  extra: { attachments?: Attachment[]; replyToId?: string | null } = {},
): Message {
  const message: Message = {
    id: makeId("m"),
    authorId,
    text,
    createdAt: new Date().toISOString(),
    kind,
    attachments: extra.attachments ?? [],
    replyToId: extra.replyToId ?? null,
    editedAt: null,
    deletedAt: null,
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
  extra: {
    /**
     * Já resolvidos pelo servidor (`media` registrada ou GIF conferido) —
     * nunca a descrição que o navegador mandou.
     */
    attachments?: Attachment[];
    replyToId?: string | null;
  } = {},
): Promise<ConversationDetail | undefined> {
  const clean = (text ?? "").trim();
  const attachments = extra.attachments ?? [];
  if (!clean && attachments.length === 0) throw new ValidationError("Mensagem vazia.");
  if (clean.length > MESSAGE_MAX) {
    throw new ValidationError("Mensagem longa demais.");
  }
  if (attachments.length > ATTACHMENTS_MAX) {
    throw new ValidationError(`Uma mensagem leva até ${ATTACHMENTS_MAX} anexos.`);
  }
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    // Responder a algo que não é desta conversa (ou não existe) vira mensagem comum.
    const replyToId =
      extra.replyToId && conversation.messages.some((m) => m.id === extra.replyToId)
        ? extra.replyToId
        : null;
    pushMessage(conversation, viewerId, clean, "texto", { attachments, replyToId });
    return detail(conversation, membersOf(data, scope), viewerId);
  });
}

/**
 * Quem escreveu edita o texto, dentro da janela de `MESSAGE_EDIT_WINDOW_MS`.
 * Mensagem de outra pessoa, linha de sistema, apagada ou velha demais:
 * `ForbiddenError` — a conversa existe (a pessoa está nela), então não há o
 * que esconder com um 404.
 */
export async function editMessage(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  messageId: string,
  text: string,
  now = Date.now(),
): Promise<ConversationDetail | undefined> {
  const clean = (text ?? "").trim();
  if (clean.length > MESSAGE_MAX) throw new ValidationError("Mensagem longa demais.");
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!conversation || !message) return undefined;
    if (!canChangeMessage(message, viewerId, now)) {
      throw new ForbiddenError("Só dá para editar a sua mensagem, até 10 minutos depois de enviada.");
    }
    if (!clean && message.attachments.length === 0) throw new ValidationError("Mensagem vazia.");
    if (clean !== message.text) {
      message.text = clean;
      message.editedAt = new Date(now).toISOString();
    }
    return detail(conversation, membersOf(data, scope), viewerId);
  });
}

/**
 * Quem escreveu apaga, na mesma janela da edição. A linha continua ("mensagem
 * apagada") para as respostas a ela não ficarem órfãs; texto e anexos somem.
 * Devolve também os anexos que saíram, para quem chama apagar os arquivos.
 */
export async function deleteMessage(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  messageId: string,
  now = Date.now(),
): Promise<
  { conversation: ConversationDetail; removed: Attachment[]; text: string } | undefined
> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    const message = conversation?.messages.find((m) => m.id === messageId);
    if (!conversation || !message) return undefined;
    if (!canChangeMessage(message, viewerId, now)) {
      throw new ForbiddenError("Só dá para apagar a sua mensagem, até 10 minutos depois de enviada.");
    }
    const removed = message.attachments;
    const text = message.text;
    message.text = "";
    message.attachments = [];
    message.deletedAt = new Date(now).toISOString();
    return { conversation: detail(conversation, membersOf(data, scope), viewerId), removed, text };
  });
}

/**
 * Quem está numa conversa e quem a silenciou — o que a notificação da
 * mensagem precisa saber de todo mundo, não só de quem mandou.
 */
export async function conversationAudience(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<{ memberIds: string[]; mutedBy: string[] } | undefined> {
  const conversation = find(await read(), scope, viewerId, id);
  return conversation && { memberIds: [...conversation.memberIds], mutedBy: [...conversation.mutedBy] };
}

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
 * mesma pessoa em duas abas é uma pessoa só na chamada. Antes de entrar, a
 * chamada abandonada (todo mundo calado) fecha com a linha dela — senão a
 * chamada nova herdaria o horário de início da velha.
 */
export async function joinCall(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<ConversationDetail | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const members = membersOf(data, scope);
    const now = Date.now();
    applyCall(conversation, members, settleCall(conversation.call, now));
    conversation.call = joinedCall(conversation.call, viewerId, now);
    return detail(conversation, members, viewerId);
  });
}

/**
 * O "ainda estou aqui" de quem está na chamada, a cada `CALL_HEARTBEAT_MS`.
 *
 * Também limpa quem sumiu. Devolve `changed` quando a lista de quem está na
 * chamada mudou, para a rota avisar o resto da conversa. Se a chamada já
 * acabou (a pessoa ficou tempo demais sem sinal), não reabre: `inCall` falso
 * é a tela sabendo que ela caiu.
 */
export async function touchCall(
  scope: AgencyScope,
  viewerId: string,
  id: string,
): Promise<
  { conversation: ConversationDetail; inCall: boolean; changed: boolean } | undefined
> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    const members = membersOf(data, scope);
    const now = Date.now();
    const settled = settleCall(conversation.call, now);
    applyCall(conversation, members, settled);
    const call = conversation.call;
    const inCall = !!call && call.memberIds.includes(viewerId);
    if (inCall) conversation.call = joinedCall(call, viewerId, now);
    return {
      conversation: detail(conversation, members, viewerId),
      inCall,
      changed: settled.changed,
    };
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
    if (!conversation.call) return detail(conversation, members, viewerId);
    const now = Date.now();
    const left = leftCall(conversation.call, viewerId, now);
    applyCall(conversation, members, left);
    if (left.call) applyCall(conversation, members, settleCall(left.call, now));
    // Quem fechou a chamada acabou de ler a linha que ele mesmo gerou.
    if (left.ended) conversation.readAt[viewerId] = new Date(now).toISOString();
    return detail(conversation, members, viewerId);
  });
}

/* ----------------------------------------------------------------- grupos */

/** Teto de gente num grupo — é conversa de time, não lista de transmissão. */
export const GROUP_MAX_MEMBERS = 50;

/**
 * Cria um grupo com você e mais gente do time. É o que o "adicionar alguém"
 * faz numa direta: a direta continua como estava (o histórico dela é de
 * duas pessoas) e nasce um grupo com as três. Sem nome, o título é quem está
 * nele — ver `groupFallbackTitle`.
 */
export async function createGroup(
  scope: AgencyScope,
  viewerId: string,
  memberIds: string[],
  name = "",
): Promise<ConversationDetail | undefined> {
  const others = [...new Set(memberIds.map(String))].filter((id) => id !== viewerId);
  if (others.length < 2) {
    throw new ValidationError("Um grupo precisa de pelo menos mais duas pessoas.");
  }
  if (others.length + 1 > GROUP_MAX_MEMBERS) {
    throw new ValidationError(`Um grupo vai até ${GROUP_MAX_MEMBERS} pessoas.`);
  }
  const clean = String(name ?? "").trim().slice(0, 80);
  return transaction((data) => {
    const members = membersOf(data, scope);
    // Alguém que não é da agência some junto com o grupo inteiro: mesma
    // resposta de "não existe", nunca um grupo criado pela metade.
    if (![viewerId, ...others].every((id) => members.some((m) => m.id === id))) {
      return undefined;
    }
    const now = new Date().toISOString();
    const created: Conversation = {
      id: makeId("g"),
      agencyId: scope.agencyId,
      kind: "grupo",
      name: clean,
      memberIds: [viewerId, ...others],
      messages: [],
      mutedBy: [],
      readAt: { [viewerId]: now },
      call: null,
      createdAt: now,
    };
    pushMessage(created, viewerId, `${memberName(members, viewerId)} criou o grupo.`, "aviso");
    data.conversations.push(created);
    return detail(created, members, viewerId);
  });
}

/**
 * Adiciona alguém do time a um grupo de que você participa. O histórico
 * inteiro passa a valer para quem entrou — é o que o time espera de um
 * grupo, e o aviso na conversa deixa claro quem trouxe quem.
 */
export async function addGroupMember(
  scope: AgencyScope,
  viewerId: string,
  id: string,
  memberId: string,
): Promise<ConversationDetail | undefined> {
  return transaction((data) => {
    const conversation = find(data, scope, viewerId, id);
    if (!conversation) return undefined;
    if (conversation.kind !== "grupo") {
      throw new ValidationError("Numa direta, adicionar alguém cria um grupo novo.");
    }
    const members = membersOf(data, scope);
    const added = members.find((m) => m.id === memberId);
    if (!added) return undefined;
    if (conversation.memberIds.includes(memberId)) {
      throw new ValidationError(`${added.name} já está no grupo.`);
    }
    if (conversation.memberIds.length >= GROUP_MAX_MEMBERS) {
      throw new ValidationError(`Um grupo vai até ${GROUP_MAX_MEMBERS} pessoas.`);
    }
    conversation.memberIds.push(memberId);
    pushMessage(
      conversation,
      viewerId,
      `${memberName(members, viewerId)} adicionou ${added.name}.`,
      "aviso",
    );
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

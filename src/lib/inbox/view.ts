import { activeCallMembers } from "./call";
import { isOnline } from "./constants";
import type {
  Conversation,
  ConversationSummary,
  InboxMember,
  Message,
} from "./types";

/*
 * O que a tela do Inbox mostra — só funções puras, como `tasks/view.ts` e
 * `clients/view.ts`. A view não guarda regra nenhuma: título da conversa,
 * prévia, não lidas, ordem, agrupamento por dia e os carimbos de hora saem
 * todos daqui, e é por isso que dá para testá-los sem subir o app
 * (`tests/inbox-view.test.ts`).
 */

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const WEEKDAYS_LONG = [
  "DOMINGO",
  "SEGUNDA",
  "TERÇA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SÁBADO",
];

const MONTHS_LONG = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

/** Texto comparável: sem acento, sem caixa — o mesmo critério da busca. */
export function normalize(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Diferença em dias de calendário (não em 24h): "ontem" às 23h é 1, não 0. */
function daysApart(iso: string, now: number): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.round(
    (startOfDay(new Date(now)) - startOfDay(then)) / 86_400_000,
  );
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Carimbo da lista de conversas, como o export escreve: "agora", "10:24" no
 * mesmo dia, "ontem", o dia da semana dentro da semana e "18/09" depois disso.
 */
export function listTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((now - d.getTime()) / 60000);
  if (minutes < 1) return "agora";
  const days = daysApart(iso, now);
  if (days <= 0) return hhmm(d);
  if (days === 1) return "ontem";
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}`;
}

/** Hora ao lado do nome, dentro da conversa: "09:14". */
export function messageTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : hhmm(d);
}

/** Chave do dia (AAAA-MM-DD local) — é por ela que as mensagens se agrupam. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Divisória de dia: "HOJE", "ONTEM" ou "SEXTA, 19 DE SETEMBRO". */
export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = daysApart(iso, now);
  if (days === 0) return "HOJE";
  if (days === 1) return "ONTEM";
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} DE ${MONTHS_LONG[d.getMonth()]}`;
}

export type MessageDay = { key: string; label: string; messages: Message[] };

/** As mensagens em blocos de dia, na ordem em que aconteceram. */
export function groupByDay(messages: Message[], now = Date.now()): MessageDay[] {
  const days: MessageDay[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.messages.push(message);
    else days.push({ key, label: dayLabel(message.createdAt, now), messages: [message] });
  }
  return days;
}

/** Duas mensagens seguidas do mesmo autor, coladas no tempo, viram um bloco. */
const BLOCK_GAP_MS = 5 * 60_000;

/**
 * Se a mensagem abre um bloco novo (avatar + nome + hora) ou é continuação da
 * anterior — as linhas "Cont" do export, do mesmo autor e minutos depois.
 */
export function startsBlock(message: Message, previous?: Message): boolean {
  if (!previous) return true;
  if (message.kind !== "texto" || previous.kind !== "texto") return true;
  if (message.authorId !== previous.authorId) return true;
  if (dayKey(message.createdAt) !== dayKey(previous.createdAt)) return true;
  const gap =
    new Date(message.createdAt).getTime() -
    new Date(previous.createdAt).getTime();
  return !(gap >= 0 && gap <= BLOCK_GAP_MS);
}

export function memberName(members: InboxMember[], id: string): string {
  return members.find((m) => m.id === id)?.name ?? "—";
}

/** Quem está do outro lado — todo mundo menos quem está olhando. */
export function otherMembers(
  conversation: Conversation,
  members: InboxMember[],
  viewerId: string,
): InboxMember[] {
  return conversation.memberIds
    .filter((id) => id !== viewerId)
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is InboxMember => !!m);
}

/**
 * O nome de um grupo que ainda não ganhou nome (o que nasce do "adicionar
 * alguém" numa direta): quem está nele, sem você — "Marina e Ana",
 * "Marina, Ana e Pedro", "Marina, Ana e mais 3".
 */
export function groupFallbackTitle(others: InboxMember[]): string {
  const names = others.map((m) => m.name);
  if (names.length === 0) return "Grupo";
  if (names.length === 1) return names[0];
  if (names.length <= 3) {
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  }
  return `${names.slice(0, 2).join(", ")} e mais ${names.length - 2}`;
}

/** Grupo mostra o nome dele; direta mostra quem está do outro lado. */
export function conversationTitle(
  conversation: Conversation,
  members: InboxMember[],
  viewerId: string,
): string {
  if (conversation.kind === "grupo") {
    return conversation.name.trim() || groupFallbackTitle(otherMembers(conversation, members, viewerId));
  }
  const other = otherMembers(conversation, members, viewerId)[0];
  return other?.name ?? conversation.name ?? "Conversa";
}

/** "Clínica Aurora" → "CA"; "Marina" → "M". Mesma régua de `ui/Mark`. */
export function initialsOf(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

export function lastMessage(conversation: Conversation): Message | undefined {
  return conversation.messages[conversation.messages.length - 1];
}

/**
 * A segunda linha da lista. No grupo ela diz quem falou ("Marina: fechei o
 * export ok"); na direta o nome só aparece quando quem falou foi você — é o
 * que o export escreve, e é a informação que falta em cada caso.
 */
export function previewOf(
  conversation: Conversation,
  members: InboxMember[],
  viewerId: string,
): string {
  const message = lastMessage(conversation);
  if (!message) return "";
  const text = message.text.replace(/\s+/g, " ").trim();
  if (message.kind !== "texto") return text;
  if (message.authorId === viewerId) return `Você: ${text}`;
  if (conversation.kind === "direta") return text;
  return `${memberName(members, message.authorId)}: ${text}`;
}

/**
 * Não lidas de quem está olhando: o que chegou depois da última leitura, sem
 * contar o que a própria pessoa escreveu nem as linhas de sistema.
 */
export function unreadCount(conversation: Conversation, viewerId: string): number {
  const read = Date.parse(conversation.readAt[viewerId] ?? "");
  const since = Number.isNaN(read) ? 0 : read;
  return conversation.messages.filter(
    (m) =>
      m.kind === "texto" &&
      m.authorId !== viewerId &&
      new Date(m.createdAt).getTime() > since,
  ).length;
}

/** A conversa resolvida para quem está olhando. */
export function summarize(
  conversation: Conversation,
  members: InboxMember[],
  viewerId: string,
  now = Date.now(),
): ConversationSummary {
  const others = otherMembers(conversation, members, viewerId);
  const title = conversationTitle(conversation, members, viewerId);
  const participants = conversation.memberIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is InboxMember => !!m);
  const last = lastMessage(conversation);

  return {
    id: conversation.id,
    kind: conversation.kind,
    title,
    /*
     * O grupo empilha duas marcas, como o export: a do grupo na frente e a de
     * um membro atrás. A direta traz só a inicial de quem está do outro lado.
     */
    initials:
      conversation.kind === "grupo"
        ? [
            // Grupo sem nome se chama "Marina e Ana": a marca é a inicial de
            // cada uma (MA), não a das duas primeiras palavras (ME).
            conversation.name.trim()
              ? initialsOf(title)
              : others
                  .slice(0, 2)
                  .map((m) => m.name.charAt(0))
                  .join("")
                  .toUpperCase() || "—",
            initialsOf(others[0]?.name ?? ""),
          ]
        : [initialsOf(title)],
    preview: previewOf(conversation, members, viewerId),
    lastAt: last?.createdAt ?? null,
    unread: unreadCount(conversation, viewerId),
    muted: conversation.mutedBy.includes(viewerId),
    presence: conversation.kind === "direta" ? (others[0]?.presence ?? "offline") : null,
    memberIds: participants.map((m) => m.id),
    memberCount: participants.length,
    onlineCount: participants.filter((m) => isOnline(m.presence)).length,
    // Só quem deu sinal de vida: quem sumiu não aparece "na chamada".
    callMemberIds: activeCallMembers(conversation.call, now),
  };
}

/** Mais recente primeiro; conversa sem mensagem nenhuma vai para o fim. */
export function sortSummaries(list: ConversationSummary[]): ConversationSummary[] {
  return [...list].sort((a, b) => {
    if (!a.lastAt && !b.lastAt) return a.title.localeCompare(b.title, "pt-BR");
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return b.lastAt.localeCompare(a.lastAt);
  });
}

/** As duas seções da lista, na ordem do export. */
export function splitByKind(list: ConversationSummary[]): {
  grupos: ConversationSummary[];
  diretas: ConversationSummary[];
} {
  return {
    grupos: list.filter((c) => c.kind === "grupo"),
    diretas: list.filter((c) => c.kind === "direta"),
  };
}

/** A busca da lista: casa com o nome da conversa e com a prévia. */
export function matchesQuery(item: ConversationSummary, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(item.title).includes(q) || normalize(item.preview).includes(q);
}

/** A busca dentro da conversa — o histórico fica salvo, e é pesquisável. */
export function searchMessages(messages: Message[], query: string): Message[] {
  const q = normalize(query);
  if (!q) return messages;
  return messages.filter((m) => normalize(m.text).includes(q));
}

/**
 * A frase da chamada, como o export escreve: "Marina iniciou uma chamada que
 * durou 12 minutos." Abaixo de um minuto a conta é em segundos — arredondar
 * para "0 minutos" seria dizer que não houve chamada.
 */
export function callSummary(author: string, seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) {
    return `${author} iniciou uma chamada que durou ${total} ${
      total === 1 ? "segundo" : "segundos"
    }.`;
  }
  const minutes = Math.round(total / 60);
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  if (minutes < 60) {
    return `${author} iniciou uma chamada que durou ${plural(minutes, "minuto", "minutos")}.`;
  }
  // Chamada longa agora fica registrada inteira: "300 minutos" ninguém lê.
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const duration = rest
    ? `${plural(hours, "hora", "horas")} e ${plural(rest, "minuto", "minutos")}`
    : plural(hours, "hora", "horas");
  return `${author} iniciou uma chamada que durou ${duration}.`;
}

/** Cronômetro da chamada em curso: "00:42", "12:03", "1:02:15". */
export function callClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const s = String(total % 60).padStart(2, "0");
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${String(m).padStart(2, "0")}:${s}`;
}

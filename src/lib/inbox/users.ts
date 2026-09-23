import type { InboxMember, MemberRole, MemberStatus } from "./types";

/*
 * A régua da tela de Usuários (export "Usuários · Painel (Lista)"): função,
 * status e o "último acesso" escrito como o desenho escreve. Função pura,
 * testada em `tests/inbox-users.test.ts`.
 *
 * As cores do selo de status são a escala de saúde do cliente — o produto tem
 * uma paleta com significado só (ver o README): verde é ativo, âmbar é algo
 * esperando alguém, cinza é parado.
 */

export const MEMBER_ROLES: { id: MemberRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "gerente", label: "Gerente" },
  { id: "editor", label: "Editor" },
  { id: "visualizador", label: "Visualizador" },
  { id: "financeiro", label: "Financeiro" },
];

export const ROLE_LABEL = Object.fromEntries(MEMBER_ROLES.map((r) => [r.id, r.label])) as Record<
  MemberRole,
  string
>;

export function isMemberRole(v: unknown): v is MemberRole {
  return MEMBER_ROLES.some((r) => r.id === v);
}

export const MEMBER_STATUSES: {
  id: MemberStatus;
  label: string;
  /** Aba da tela. */
  tab: string;
  bg: string;
  fg: string;
}[] = [
  { id: "ativo", label: "Ativo", tab: "Ativos", bg: "var(--color-client-ativo-bg)", fg: "var(--color-client-ativo-fg)" },
  {
    id: "convite",
    label: "Convite pendente",
    tab: "Convite pendente",
    bg: "var(--color-client-renovacao-bg)",
    fg: "var(--color-client-renovacao-fg)",
  },
  { id: "inativo", label: "Inativo", tab: "Inativos", bg: "var(--color-client-pausado-bg)", fg: "var(--color-client-pausado-fg)" },
  { id: "arquivado", label: "Arquivado", tab: "Arquivados", bg: "var(--color-client-pausado-bg)", fg: "var(--color-faint)" },
];

export const STATUS_BY_ID = Object.fromEntries(MEMBER_STATUSES.map((s) => [s.id, s])) as Record<
  MemberStatus,
  (typeof MEMBER_STATUSES)[number]
>;

export function isMemberStatus(v: unknown): v is MemberStatus {
  return MEMBER_STATUSES.some((s) => s.id === v);
}

/** Quem trabalha de fato: recebe tarefa de fluxo e aparece no menu de @. */
export function isWorking(m: Pick<InboxMember, "status">): boolean {
  return m.status === "ativo";
}

/** Quem pode mexer no time: adicionar, trocar função, arquivar. */
export function canManageTeam(m: Pick<InboxMember, "role">): boolean {
  return m.role === "admin" || m.role === "gerente";
}

/** "há 2 min", "há 1 h", "há 3 dias", "há 2 sem" — ou "—" para quem nunca entrou. */
export function lastSeenLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const ms = now - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const w = Math.floor(d / 7);
  if (w < 5) return `há ${w} sem`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `há ${mo} ${mo === 1 ? "mês" : "meses"}` : `há ${Math.floor(d / 365)} a`;
}

/** Busca da tela: nome, @ ou e-mail, sem acento e sem caixa. */
export function matchesMember(m: Pick<InboxMember, "name" | "handle" | "email">, query: string): boolean {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const q = fold(query.trim().replace(/^@/, ""));
  if (!q) return true;
  return [m.name, m.handle, m.email].some((v) => fold(v).includes(q));
}

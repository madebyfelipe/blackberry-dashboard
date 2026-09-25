import type { Batch } from "@/lib/approval/types";
import type { Client, ClientStatus } from "@/lib/clients/types";
import type { ClientAccount, ClientEvent, ContractCycle, EventKind } from "@/lib/crm/types";
import { daysBetween, isBilled, monthKey, parseDateKey } from "@/lib/crm/view";
import { isOnline } from "@/lib/inbox/constants";
import type { InboxMember, Presence } from "@/lib/inbox/types";
import type { Task, TaskStatus } from "@/lib/tasks/types";

/*
 * O painel da agência (Configurações › Painel da agência): tudo o que ele
 * mostra sai daqui, calculado na hora a partir do que já está gravado —
 * nenhum número do painel é guardado. Função pura, testada em
 * `tests/dashboard-metrics.test.ts`.
 *
 * Filtros: o **mês** decide "no mês" (tarefas do mês, decisões, recebido,
 * entregas); o **cliente** recorta tarefas, lotes, dinheiro, entregas e
 * agenda; a **pessoa** recorta as tarefas (é de quem a tarefa é). O que é
 * "agora" (atrasadas, vencidas, esperando o cliente) é sempre pela data de
 * hoje, qualquer que seja o mês escolhido.
 *
 * Dinheiro em centavos, como no resto do CRM.
 */

export type DashboardInput = {
  tasks: Task[];
  batches: Batch[];
  clients: Client[];
  accounts: ClientAccount[];
  members: InboxMember[];
  /** "2026-09" */
  month: string;
  clientId: string | null;
  /** O nome da pessoa como fica na tarefa (`Task.assignee`). */
  person: string | null;
  now: Date;
};

/** A meta de "concluídas no prazo" da agência (fixa por ora — ROADMAP). */
export const ON_TIME_GOAL = 85;

const OPEN: TaskStatus[] = ["a-fazer", "em-progresso", "em-revisao"];
const DONE: TaskStatus = "concluido";

export const STATUS_ORDER: TaskStatus[] = ["concluido", "em-revisao", "em-progresso", "a-fazer", "pausado", "cancelado"];

export const CLIENT_STATUS_ORDER: ClientStatus[] = ["ativo", "vip", "novo", "renovacao", "pausado", "risco"];

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

/** "2026-09" → "2026-08". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 2, 1));
}

/** Os últimos `n` meses, do atual para trás — as opções do filtro. */
export function recentMonths(now: Date, n = 12): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

const inRange = (iso: string | null | undefined, r: { start: Date; end: Date }) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
};

/** A tarefa "esteve no mês": criada até o fim dele e não terminada antes de ele começar. */
function taskInMonth(t: Task, r: { start: Date; end: Date }): boolean {
  if (new Date(t.createdAt).getTime() >= r.end.getTime()) return false;
  if (t.completedAt && new Date(t.completedAt).getTime() < r.start.getTime()) return false;
  return true;
}

function isLate(t: Task, now: Date): boolean {
  if (!OPEN.includes(t.status)) return false;
  const due = parseDateKey(t.dueDate?.slice(0, 10));
  return !!due && daysBetween(due, now) > 0;
}

/* ================================================================ tarefas */

export type OperationStats = {
  open: number;
  /** Tarefas criadas no mês (o "N criadas em setembro" do KPI). */
  created: number;
  late: number;
  /** % das concluídas no mês que tinham prazo e ficaram dentro dele. `null` = nenhuma. */
  onTime: number | null;
  byStatus: { status: TaskStatus; count: number }[];
  inMonth: number;
  load: { name: string; open: number }[];
};

export function operationStats(input: DashboardInput): OperationStats {
  const r = monthRange(input.month);
  const tasks = input.tasks.filter(
    (t) =>
      (!input.clientId || t.clientId === input.clientId) &&
      (!input.person || t.assignee.trim().toLowerCase() === input.person.trim().toLowerCase()),
  );
  const open = tasks.filter((t) => OPEN.includes(t.status));
  const month = tasks.filter((t) => taskInMonth(t, r));
  const done = tasks.filter((t) => t.status === DONE && inRange(t.completedAt, r) && t.dueDate);
  const onTimeCount = done.filter((t) => {
    const due = parseDateKey(t.dueDate!.slice(0, 10));
    return !!due && daysBetween(due, new Date(t.completedAt!)) <= 0;
  }).length;

  const load = new Map<string, number>();
  for (const t of open) {
    const name = t.assignee.trim();
    if (!name || name === "—") continue;
    load.set(name, (load.get(name) ?? 0) + 1);
  }

  return {
    open: open.length,
    created: tasks.filter((t) => inRange(t.createdAt, r)).length,
    late: tasks.filter((t) => isLate(t, input.now)).length,
    onTime: done.length ? Math.round((onTimeCount / done.length) * 100) : null,
    byStatus: STATUS_ORDER.map((status) => ({ status, count: month.filter((t) => t.status === status).length })),
    inMonth: month.length,
    load: [...load.entries()]
      .map(([name, n]) => ({ name, open: n }))
      .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 6),
  };
}

/* ============================================================== aprovação */

export type WaitingBatch = { id: string; client: string; label: string; pending: number; days: number };

export type ApprovalStats = {
  pending: number;
  /** Lotes com peça esperando o cliente. */
  waitingBatches: number;
  approved: number;
  adjust: number;
  /** Média, em dias, do envio à decisão do cliente no mês. `null` = nenhuma decisão. */
  avgDecisionDays: number | null;
  /** A mesma média no mês anterior — para o "−0,6 dia vs. agosto". */
  prevAvgDecisionDays: number | null;
  /** % das decisões do mês que pediram ajuste. */
  adjustRate: number | null;
  waiting: WaitingBatch[];
};

const SENT = "Enviada para aprovação";
const APPROVED = "Aprovada pelo cliente";
const ADJUST = "Ajuste pedido pelo cliente";

/** As decisões do cliente num mês, com quanto tempo cada uma levou desde o envio. */
function decisions(batches: Batch[], month: string) {
  const r = monthRange(month);
  const out: { kind: "aprovado" | "ajuste"; ms: number | null }[] = [];
  for (const b of batches) {
    for (const p of b.pieces) {
      // O histórico vem do mais novo para o mais velho.
      const events = [...p.history].reverse();
      let sentAt: number | null = null;
      for (const e of events) {
        if (e.title === SENT && e.at) sentAt = new Date(e.at).getTime();
        if ((e.title === APPROVED || e.title === ADJUST) && inRange(e.at, r)) {
          const at = new Date(e.at!).getTime();
          out.push({ kind: e.title === APPROVED ? "aprovado" : "ajuste", ms: sentAt !== null ? at - sentAt : null });
        }
      }
    }
  }
  return out;
}

function avgDays(list: { ms: number | null }[]): number | null {
  const timed = list.filter((d) => d.ms !== null && d.ms >= 0);
  if (!timed.length) return null;
  const avg = timed.reduce((s, d) => s + d.ms!, 0) / timed.length;
  return Math.round((avg / 86_400_000) * 10) / 10;
}

export function approvalStats(input: DashboardInput): ApprovalStats {
  const batches = input.batches.filter((b) => !input.clientId || b.clientId === input.clientId);
  const sent = batches.filter((b) => b.stage === "em-aprovacao");
  const now = decisions(batches, input.month);
  const prev = decisions(batches, previousMonth(input.month));

  const waiting: WaitingBatch[] = [];
  for (const b of sent) {
    const pending = b.pieces.filter((p) => p.status === "pendente");
    if (!pending.length) continue;
    // Desde quando o cliente tem o lote na mão: o envio mais recente de uma peça pendente.
    let since = 0;
    for (const p of pending) {
      const s = p.history.find((e) => e.title === SENT && e.at);
      if (s?.at) since = Math.max(since, new Date(s.at).getTime());
    }
    waiting.push({
      id: b.id,
      client: b.client,
      label: b.label,
      pending: pending.length,
      days: since ? Math.max(0, daysBetween(new Date(since), input.now)) : 0,
    });
  }
  waiting.sort((a, b) => b.days - a.days || b.pending - a.pending);

  const approved = now.filter((d) => d.kind === "aprovado").length;
  const adjust = now.filter((d) => d.kind === "ajuste").length;
  return {
    pending: waiting.reduce((s, w) => s + w.pending, 0),
    waitingBatches: waiting.length,
    approved,
    adjust,
    avgDecisionDays: avgDays(now),
    prevAvgDecisionDays: avgDays(prev),
    adjustRate: now.length ? Math.round((adjust / now.length) * 100) : null,
    waiting: waiting.slice(0, 4),
  };
}

/* ============================================================= financeiro */

export type DueItem = { clientId: string; client: string; cycle: ContractCycle; dueDate: string; amount: number };
export type FidelityItem = { clientId: string; client: string; months: number; days: number };

export type FinanceStats = {
  /** Receita mensal recorrente: a soma dos serviços faturados (ativo e setup). */
  mrr: number;
  /** Clientes com algum serviço faturado. */
  payingClients: number;
  received: number;
  /** O previsto do mês: as faturas que vencem nele — ou a receita recorrente, sem faturas. */
  expected: number;
  open: { cents: number; count: number };
  overdue: { cents: number; count: number; clients: number };
  upcoming: DueItem[];
  fidelity: FidelityItem[];
};

export function financeStats(input: DashboardInput): FinanceStats {
  const r = monthRange(input.month);
  const names = new Map(input.clients.map((c) => [c.id, c.name]));
  const accounts = input.accounts.filter(
    (a) => names.has(a.clientId) && (!input.clientId || a.clientId === input.clientId),
  );
  let mrr = 0;
  let payingClients = 0;
  let received = 0;
  let dueInMonth = 0;
  const open = { cents: 0, count: 0 };
  const overdue = { cents: 0, count: 0, clients: 0 };
  const upcoming: DueItem[] = [];
  const fidelity: FidelityItem[] = [];

  for (const a of accounts) {
    const billed = a.services.filter(isBilled).reduce((s, x) => s + x.monthlyValue, 0);
    mrr += billed;
    if (billed > 0) payingClients++;
    let clientOverdue = false;
    for (const inv of a.invoices) {
      const due = parseDateKey(inv.dueDate);
      if (inv.status === "pago" && inRange(inv.paidAt ?? inv.dueDate, r)) received += inv.amount;
      if (due && due >= r.start && due < r.end) dueInMonth += inv.amount;
      if (inv.status !== "aberto" || !due) continue;
      if (daysBetween(due, input.now) > 0) {
        overdue.cents += inv.amount;
        overdue.count++;
        clientOverdue = true;
      } else {
        open.cents += inv.amount;
        open.count++;
        upcoming.push({
          clientId: a.clientId,
          client: names.get(a.clientId)!,
          cycle: a.contract.cycle,
          dueDate: inv.dueDate,
          amount: inv.amount,
        });
      }
    }
    if (clientOverdue) overdue.clients++;

    const start = parseDateKey(a.contract.startDate);
    const months = a.contract.fidelityMonths;
    if (start && months) {
      const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
      const days = daysBetween(input.now, end);
      if (days >= 0 && days <= 60) {
        fidelity.push({ clientId: a.clientId, client: names.get(a.clientId)!, months, days });
      }
    }
  }

  return {
    mrr,
    payingClients,
    received,
    expected: dueInMonth || mrr,
    open,
    overdue,
    upcoming: upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4),
    fidelity: fidelity.sort((a, b) => a.days - b.days).slice(0, 3),
  };
}

/* =============================================================== carteira */

export type RiskItem = { clientId: string; client: string; reason: string };

export type PortfolioStats = {
  total: number;
  byStatus: { status: ClientStatus; count: number }[];
  withoutFlow: number;
  atRisk: RiskItem[];
};

/**
 * Quem está em risco e por quê. Entra: status "Risco", NPS até 6, lote com
 * ajuste pedido no mês, fatura vencida há mais de uma semana. Os motivos se
 * juntam na mesma linha ("NPS 4 · 2 lotes com ajuste").
 */
export function portfolioStats(input: DashboardInput): PortfolioStats {
  const r = monthRange(input.month);
  const byStatus = CLIENT_STATUS_ORDER.map((status) => ({
    status,
    count: input.clients.filter((c) => c.status === status).length,
  }));
  const atRisk: RiskItem[] = [];
  for (const c of input.clients) {
    if (input.clientId && c.id !== input.clientId) continue;
    const reasons: string[] = [];
    if (c.nps !== null && c.nps <= 6) reasons.push(`NPS ${String(c.nps).replace(".", ",")}`);
    const adjustBatches = input.batches.filter(
      (b) =>
        b.clientId === c.id &&
        b.pieces.some((p) => p.history.some((e) => e.title === ADJUST && inRange(e.at, r))),
    ).length;
    if (adjustBatches > 0) reasons.push(`${adjustBatches} ${adjustBatches === 1 ? "lote com ajuste" : "lotes com ajuste"}`);
    const account = input.accounts.find((a) => a.clientId === c.id);
    const oldest = (account?.invoices ?? [])
      .filter((i) => i.status === "aberto")
      .map((i) => parseDateKey(i.dueDate))
      .filter((d): d is Date => !!d)
      .map((d) => daysBetween(d, input.now))
      .reduce((max, d) => Math.max(max, d), 0);
    if (oldest > 7) reasons.push(`Fatura vencida há ${oldest} dias`);
    if (c.status === "risco" && reasons.length === 0) reasons.push("Marcado em risco");
    const serious = c.status === "risco" || oldest > 7 || (c.nps !== null && c.nps <= 6);
    if (serious && reasons.length) atRisk.push({ clientId: c.id, client: c.name, reason: reasons.join(" · ") });
  }
  return {
    total: input.clients.length,
    byStatus,
    withoutFlow: input.clients.filter((c) => !c.flowId).length,
    atRisk: atRisk.slice(0, 3),
  };
}

/* ================================================================ entregas */

export type DeliveryLine = { unit: string; done: number; quota: number };

/**
 * Contratado × entregue no mês, somado por unidade ("posts", "reels"). Só
 * serviço faturado com meta conta; entrega de outro mês conta zero.
 */
export function deliveryStats(input: DashboardInput): { done: number; quota: number; lines: DeliveryLine[] } {
  const lines = new Map<string, DeliveryLine>();
  for (const a of input.accounts) {
    if (input.clientId && a.clientId !== input.clientId) continue;
    for (const s of a.services) {
      if (!isBilled(s) || !s.quota) continue;
      const key = (s.unit || "entregas").trim().toLowerCase();
      const line = lines.get(key) ?? { unit: key, done: 0, quota: 0 };
      line.quota += s.quota;
      line.done += s.deliveredMonth === input.month ? Math.min(s.quota, s.delivered) : 0;
      lines.set(key, line);
    }
  }
  const list = [...lines.values()].sort((a, b) => b.quota - a.quota);
  return {
    done: list.reduce((s, l) => s + l.done, 0),
    quota: list.reduce((s, l) => s + l.quota, 0),
    lines: list,
  };
}

/* ================================================================== equipe */

export type TeamStats = {
  active: number;
  online: number;
  invites: number;
  requests: { id: string; name: string; email: string; createdAt: string }[];
  lastSeen: { id: string; name: string; title: string; presence: Presence; lastSeenAt: string; photoUrl: string | null }[];
};

export function teamStats(members: InboxMember[]): TeamStats {
  const active = members.filter((m) => m.status === "ativo");
  return {
    active: active.length,
    online: active.filter((m) => isOnline(m.presence)).length,
    invites: members.filter((m) => m.status === "convite" && !m.joinRequest).length,
    requests: members
      .filter((m) => m.joinRequest)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ id: m.id, name: m.name, email: m.email, createdAt: m.createdAt })),
    lastSeen: active
      .filter((m) => m.lastSeenAt)
      .sort((a, b) => b.lastSeenAt!.localeCompare(a.lastSeenAt!))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        name: m.name,
        title: m.title,
        presence: m.presence,
        lastSeenAt: m.lastSeenAt!,
        photoUrl: m.photoUrl,
      })),
  };
}

/* ================================================================== agenda */

export type AgendaItem = { id: string; client: string; kind: EventKind; title: string; at: string; place: string };

/** Os próximos eventos de todas as fichas, de hoje em diante. */
export function agenda(input: DashboardInput, limit = 5): AgendaItem[] {
  const names = new Map(input.clients.map((c) => [c.id, c.name]));
  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const out: AgendaItem[] = [];
  for (const a of input.accounts) {
    if (!names.has(a.clientId) || (input.clientId && a.clientId !== input.clientId)) continue;
    for (const e of a.events as ClientEvent[]) {
      if (new Date(e.at).getTime() < today) continue;
      out.push({ id: e.id, client: names.get(a.clientId)!, kind: e.kind, title: e.title, at: e.at, place: e.place });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit);
}

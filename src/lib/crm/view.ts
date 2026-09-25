import { FILE_FOLDERS, INVOICE_BADGES, paymentLabel, type FileTone, type InvoiceBadge } from "./constants";
import type {
  Activity,
  ActivityKind,
  ClientAccount,
  ClientEvent,
  ClientFile,
  ClientService,
  Contract,
  Invoice,
} from "./types";
import type { ClientStatus } from "@/lib/clients/types";

/*
 * A régua da ficha do cliente: dinheiro, datas, os números dos cartões de
 * cima de cada aba e a linha do tempo de Atividades. Tudo função pura, sem
 * `Date.now()` escondido — quem chama passa o `now` —, testada em
 * `tests/crm-view.test.ts`. Roda no servidor e no navegador.
 */

/* ================================================================ dinheiro */

/** "R$ 8.500" · "R$ 8.500,50" — centavos só quando existem. */
export function formatMoney(cents: number): string {
  const value = cents / 100;
  const hasCents = Math.round(cents) % 100 !== 0;
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

/** "R$ 178k" · "R$ 1,2 mi" — o LTV do cartão, que não precisa de centavo. */
export function formatMoneyCompact(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (Math.abs(value) >= 10_000) return `R$ ${Math.round(value / 1000)}k`;
  return formatMoney(cents);
}

/**
 * O que a pessoa digita no campo de valor → centavos. Aceita "3200",
 * "3.200", "3.200,50", "R$ 3200,5" e "3200.50". `null` quando não é número.
 */
export function parseMoney(input: string): number | null {
  let s = String(input ?? "").replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/* =================================================================== datas */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09" — a chave de mês (competência, entregas do mês). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "2026-10-05" — data sem hora, no fuso de quem chama. */
export function dateKey(d: Date): string {
  return `${monthKey(d)}-${pad(d.getDate())}`;
}

/** "2026-10-05" → Date local, meia-noite. Inválido → `null`. */
export function parseDateKey(key: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(d.getDate(), last));
  return out;
}

/** "2026-10" → "Outubro 2026" — a coluna COMPETÊNCIA. */
export function competenceLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return MONTHS_LONG[m - 1] ? `${MONTHS_LONG[m - 1]} ${y}` : key;
}

/** "2026-10" → "outubro" — no meio de frase ("Pagamento de outubro"). */
export function monthName(key: string): string {
  const m = Number(key.split("-")[1]);
  return MONTHS_LONG[m - 1]?.toLowerCase() ?? key;
}

/** "jan/2024" — "Cliente desde", "Renova em", "Início". */
export function monthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

/** "05/10" — a coluna VENCIMENTO. */
export function dayMonth(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** "05/out" — "Próx. cobrança 05/out". */
export function dayMonthShort(d: Date): string {
  return `${pad(d.getDate())}/${MONTHS[d.getMonth()]}`;
}

/** Dias inteiros de `from` até `to`, contando pelo calendário. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/**
 * Há quanto tempo, no tom do export: "há 5 min", "há 2h", "ontem",
 * "3 dias", "2 sem", "12 jan" (e o ano, se for outro).
 */
export function relativeAgo(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  const days = daysBetween(at, now);
  if (days <= 0) {
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    return `há ${Math.floor(minutes / 60)}h`;
  }
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias`;
  if (days < 30) return `${Math.floor(days / 7)} sem`;
  const base = `${pad(at.getDate())} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? base : `${base} ${at.getFullYear()}`;
}

/** "09:24" hoje e ontem; "seg, 15:00" na semana; "12 set, 10:00" antes. */
export function activityTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const days = daysBetween(at, now);
  if (days <= 1) return hm;
  if (days < 7) return `${WEEKDAYS[at.getDay()]}, ${hm}`;
  return `${pad(at.getDate())} ${MONTHS[at.getMonth()]}, ${hm}`;
}

/** "2h" · "35min" · "1d 4h" — a "Resp. média". */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

/* ============================================================ identidade */

/**
 * "#AUR-0451" sem o "#": três letras da última palavra do nome e quatro
 * dígitos tirados do id. Estável — o mesmo cliente tem sempre o mesmo.
 */
export function clientCode(client: { id: string; name: string }): string {
  const words = client.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const word = words[words.length - 1] ?? "CLI";
  const letters = (word + "XXX").slice(0, 3);
  let h = 0;
  for (let i = 0; i < client.id.length; i++) h = (h * 31 + client.id.charCodeAt(i)) >>> 0;
  return `${letters}-${String(h % 10000).padStart(4, "0")}`;
}

/** Meses de relação, contando o mês corrente — "Cliente há 21 meses". Mínimo 1. */
export function monthsAsClient(sinceIso: string, now: Date): number {
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) return 1;
  const months = (now.getFullYear() - since.getFullYear()) * 12 + (now.getMonth() - since.getMonth());
  return Math.max(1, months + 1);
}

/** Desde quando é cliente: o início do contrato, ou o cadastro. */
export function clientSince(contract: Contract, createdAt: string): Date {
  return parseDateKey(contract.startDate) ?? new Date(createdAt);
}

/* =============================================================== serviços */

/** Serviço que entra na conta do mês: ativo e em setup. Pausado não fatura. */
export function isBilled(s: ClientService): boolean {
  return s.status !== "pausado";
}

/** O "TOTAL MENSAL" e o "FATURAMENTO MENSAL" — a soma do que está sendo faturado. */
export function monthlyTotal(services: ClientService[]): number {
  return services.filter(isBilled).reduce((sum, s) => sum + s.monthlyValue, 0);
}

/** Entregas do mês corrente do serviço — de outro mês, conta zero. */
export function deliveredThisMonth(s: ClientService, now: Date): number {
  return s.deliveredMonth === monthKey(now) ? s.delivered : 0;
}

/**
 * A coluna PROGRESSO. Serviço com meta: "10/12 posts" e a barra na fração.
 * Sem meta: a situação escrita ("Em veiculação") e a barra pelo status —
 * cheia no ativo, pela metade em setup, vazia no pausado.
 */
export function serviceProgress(s: ClientService, now: Date): { label: string; ratio: number } {
  if (s.quota && s.quota > 0) {
    const done = deliveredThisMonth(s, now);
    return {
      label: `${done}/${s.quota}${s.unit ? ` ${s.unit}` : ""}`,
      ratio: Math.min(1, done / s.quota),
    };
  }
  const ratio = s.status === "ativo" ? 1 : s.status === "setup" ? 0.5 : 0;
  const fallback = s.status === "ativo" ? "Em andamento" : s.status === "setup" ? "Em setup" : "Pausado";
  return { label: s.stage.trim() || fallback, ratio };
}

/** "18 / 22" — soma das metas dos serviços faturados com meta. */
export function monthDeliveries(services: ClientService[], now: Date): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const s of services) {
    if (!isBilled(s) || !s.quota) continue;
    total += s.quota;
    done += Math.min(s.quota, deliveredThisMonth(s, now));
  }
  return { done, total };
}

/* ================================================================ faturas */

/** O selo da fatura: paga, a vencer ou atrasada (vencida e em aberto). */
export function invoiceBadge(inv: Invoice, now: Date): InvoiceBadge {
  if (inv.status === "pago") return "pago";
  const due = parseDateKey(inv.dueDate);
  return due && daysBetween(due, now) > 0 ? "atrasado" : "a-vencer";
}

export function invoiceBadgeMeta(inv: Invoice, now: Date) {
  return INVOICE_BADGES[invoiceBadge(inv, now)];
}

/** Mais recente primeiro — a ordem do histórico. */
export function sortInvoices(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort(
    (a, b) => b.competence.localeCompare(a.competence) || b.dueDate.localeCompare(a.dueDate),
  );
}

/** "EM ABERTO": soma, quantas e quantas já venceram. */
export function openInvoices(invoices: Invoice[], now: Date): { cents: number; count: number; overdue: number } {
  const open = invoices.filter((i) => i.status === "aberto");
  return {
    cents: open.reduce((s, i) => s + i.amount, 0),
    count: open.length,
    overdue: open.filter((i) => invoiceBadge(i, now) === "atrasado").length,
  };
}

/** "RECEBIDO EM 2026": o que foi pago no ano (pela data do pagamento). */
export function receivedInYear(invoices: Invoice[], year: number): { cents: number; count: number } {
  const paid = invoices.filter((i) => {
    if (i.status !== "pago") return false;
    const when = i.paidAt ? new Date(i.paidAt) : parseDateKey(i.dueDate);
    return when?.getFullYear() === year;
  });
  return { cents: paid.reduce((s, i) => s + i.amount, 0), count: paid.length };
}

/**
 * "+12% vs. mês anterior": o faturamento de agora contra a fatura do mês
 * passado. Sem fatura do mês passado não há comparação — `null`.
 */
export function mrrDelta(mrr: number, invoices: Invoice[], now: Date): number | null {
  const prevKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prev = invoices.find((i) => i.competence === prevKey);
  if (!prev || prev.amount <= 0) return null;
  return Math.round(((mrr - prev.amount) / prev.amount) * 100);
}

/** A próxima data de cobrança pelo dia do faturamento (hoje conta). */
export function nextBillingDate(billingDay: number | null, now: Date): Date | null {
  if (!billingDay || billingDay < 1 || billingDay > 31) return null;
  const today = startOfDay(now);
  for (let k = 0; k < 2; k++) {
    const first = new Date(today.getFullYear(), today.getMonth() + k, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const d = new Date(first.getFullYear(), first.getMonth(), Math.min(billingDay, last));
    if (d >= today) return d;
  }
  return null;
}

/**
 * A "PRÓXIMA FATURA": a fatura em aberto que vence primeiro ou, sem nenhuma,
 * a que o "Gerar cobrança" criaria — valor do mês, no próximo dia de
 * faturamento, numa competência que ainda não tem fatura.
 */
export function nextInvoice(
  invoices: Invoice[],
  mrr: number,
  billingDay: number | null,
  now: Date,
): { existing: Invoice | null; amount: number; dueDate: Date | null; competence: string | null } {
  const open = invoices
    .filter((i) => i.status === "aberto")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (open[0]) {
    return {
      existing: open[0],
      amount: open[0].amount,
      dueDate: parseDateKey(open[0].dueDate),
      competence: open[0].competence,
    };
  }
  let due = nextBillingDate(billingDay, now);
  if (!due) return { existing: null, amount: mrr, dueDate: null, competence: null };
  // Competência já faturada (paga): a cobrança nova é a do mês seguinte.
  while (invoices.some((i) => i.competence === monthKey(due!))) {
    due = addMonths(due, 1);
    if (billingDay) {
      const last = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
      due = new Date(due.getFullYear(), due.getMonth(), Math.min(billingDay, last));
    }
  }
  return { existing: null, amount: mrr, dueDate: due, competence: monthKey(due) };
}

/** O "Exportar" do histórico: CSV com `;` (o Excel em português abre direto). */
export function invoicesCsv(invoices: Invoice[], now: Date): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Competência", "Vencimento", "Método", "Valor", "Status", "Pago em"]];
  for (const i of sortInvoices(invoices)) {
    const due = parseDateKey(i.dueDate);
    rows.push([
      competenceLabel(i.competence),
      due ? `${dayMonth(due)}/${due.getFullYear()}` : i.dueDate,
      paymentLabel(i.method),
      (i.amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      INVOICE_BADGES[invoiceBadge(i, now)].label,
      i.paidAt ? dateKey(new Date(i.paidAt)).split("-").reverse().join("/") : "",
    ]);
  }
  return rows.map((r) => r.map(esc).join(";")).join("\n");
}

/* ================================================================ contrato */

/** "Renova em jan/2027": o próximo fim de fidelidade depois de hoje. */
export function renewalDate(contract: Contract, now: Date): Date | null {
  const start = parseDateKey(contract.startDate);
  if (!start || !contract.fidelityMonths) return null;
  let end = addMonths(start, contract.fidelityMonths);
  for (let i = 0; end <= now && i < 200; i++) end = addMonths(end, contract.fidelityMonths);
  return end;
}

/** "IPCA · jan/2027": o próximo aniversário do contrato, quando há índice. */
export function nextAdjustment(contract: Contract, now: Date): Date | null {
  const start = parseDateKey(contract.startDate);
  if (!start || !contract.adjustmentIndex.trim()) return null;
  let d = addMonths(start, 12);
  for (let i = 0; d <= now && i < 100; i++) d = addMonths(d, 12);
  return d;
}

/* ================================================================== saúde */

export type Health = { label: string; tone: "good" | "warn" | "bad" | "neutral"; sub: string };

/**
 * "SAÚDE DO CLIENTE": o degrau da carteira, rebaixado se há fatura atrasada,
 * com o NPS e as pendências embaixo.
 */
export function clientHealth(status: ClientStatus, nps: number | null, overdue: number): Health {
  let label = "Boa";
  let tone: Health["tone"] = "good";
  if (status === "risco") [label, tone] = ["Em risco", "bad"];
  else if (status === "renovacao") [label, tone] = ["Atenção", "warn"];
  else if (status === "pausado") [label, tone] = ["Pausada", "neutral"];
  else if (status === "novo") [label, tone] = ["Nova", "neutral"];
  if (overdue > 0 && (tone === "good" || tone === "neutral")) [label, tone] = ["Atenção", "warn"];
  const parts = [
    nps === null ? null : `NPS ${formatNps(nps)}`,
    overdue > 0 ? `${overdue} ${overdue === 1 ? "fatura atrasada" : "faturas atrasadas"}` : "Sem pendências",
  ].filter(Boolean);
  return { label, tone, sub: parts.join(" · ") };
}

/** "9,2" · "9" */
export function formatNps(nps: number): string {
  return nps.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/* ================================================================ arquivos */

function ext(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

/** A cor do cartão do arquivo, pelo tipo. */
export function fileTone(mime: string, name: string): FileTone {
  const e = ext(name);
  if (mime === "application/pdf" || e === "pdf") return "pdf";
  if (mime.startsWith("image/")) return e === "svg" ? "codigo" : "imagem";
  if (mime.startsWith("video/")) return "video";
  if (/sheet|excel|csv/.test(mime) || ["xls", "xlsx", "csv"].includes(e)) return "planilha";
  if (["svg", "html", "json", "js", "css"].includes(e)) return "codigo";
  return "outro";
}

/** "PDF", "PNG", "XLSX" — a primeira metade de "PDF · 1,2 MB". */
export function fileTypeLabel(name: string): string {
  return ext(name).toUpperCase() || "ARQUIVO";
}

export function folderLabel(id: ClientFile["folder"]): string {
  return FILE_FOLDERS.find((f) => f.id === id)?.label ?? id;
}

/* ================================================================ agenda */

export type UpcomingItem = { id: string; day: string; month: string; title: string; sub: string; at: Date };

/**
 * "Próximos eventos": os compromissos marcados que ainda vêm e a próxima
 * cobrança, em ordem. `limit` corta a lista do cartão.
 */
export function upcomingEvents(
  events: ClientEvent[],
  billing: { dueDate: Date | null; competence: string | null },
  now: Date,
  limit = 4,
): UpcomingItem[] {
  const items: UpcomingItem[] = events
    .filter((e) => new Date(e.at).getTime() >= now.getTime())
    .map((e) => {
      const at = new Date(e.at);
      return {
        id: e.id,
        day: pad(at.getDate()),
        month: MONTHS[at.getMonth()].toUpperCase(),
        title: e.title,
        sub: [`${pad(at.getHours())}:${pad(at.getMinutes())}`, e.place].filter(Boolean).join(" · "),
        at,
      };
    });
  if (billing.dueDate && billing.competence) {
    items.push({
      id: "cobranca",
      day: pad(billing.dueDate.getDate()),
      month: MONTHS[billing.dueDate.getMonth()].toUpperCase(),
      title: "Cobrança mensal",
      sub: `Fatura de ${monthName(billing.competence)}`,
      at: billing.dueDate,
    });
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}

/* ============================================================== atividades */

/** O mínimo do lote que a linha do tempo lê — sem depender de `lib/approval`. */
export type ActivityBatch = {
  id: string;
  label: string;
  pieces: { id: string; name: string; reason?: string; history: { title: string; who: string; at?: string }[] }[];
};

export type ActivityTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  comments: { id: string; author: string; text: string; createdAt: string }[];
};

/** Quem assina as notas automáticas do fluxo — não é conversa, fica de fora. */
const SYSTEM_AUTHOR = "black berry";

const APPROVAL_VERBS: Record<string, { one: (n: string) => string; many: (n: number) => string }> = {
  "Aprovada pelo cliente": { one: (n) => `Aprovou ${n}`, many: (n) => `Aprovou ${n} peças` },
  "Ajuste pedido pelo cliente": { one: (n) => `Pediu ajuste em ${n}`, many: (n) => `Pediu ajuste em ${n} peças` },
  "Enviada para aprovação": { one: (n) => `Enviou ${n} para aprovação`, many: (n) => `Enviou ${n} peças para aprovação` },
  "Aprovada pela agência": { one: (n) => `Aprovou ${n} pela agência`, many: (n) => `Aprovou ${n} peças pela agência` },
};

/**
 * A linha do tempo do cliente, montada do que já existe: decisões nos lotes
 * (agrupadas — aprovar 12 peças de uma vez é uma atividade, não doze),
 * comentários nas tarefas, arquivos, faturas e compromissos que já
 * passaram. Mais recente primeiro.
 */
export function buildActivities(input: {
  batches: ActivityBatch[];
  tasks: ActivityTask[];
  account: Pick<ClientAccount, "files" | "invoices" | "events">;
  now: Date;
}): Activity[] {
  const out: Activity[] = [];

  // Aprovações: mesma decisão, mesmo lote, mesma pessoa, na mesma hora → uma linha.
  const groups = new Map<string, { title: string; who: string; at: string; batch: string; names: string[]; reason?: string }>();
  for (const b of input.batches) {
    for (const p of b.pieces) {
      for (const h of p.history) {
        if (!h.at || !APPROVAL_VERBS[h.title]) continue;
        const who = h.who.split(" · ")[0] || "—";
        const hour = Math.floor(new Date(h.at).getTime() / 3_600_000);
        const key = `${b.id}|${h.title}|${who}|${hour}`;
        const g = groups.get(key);
        if (g) {
          g.names.push(p.name);
          if (h.at > g.at) g.at = h.at;
        } else {
          groups.set(key, { title: h.title, who, at: h.at, batch: b.label, names: [p.name], reason: p.reason });
        }
      }
    }
  }
  for (const [key, g] of groups) {
    const verb = APPROVAL_VERBS[g.title];
    const single = g.names.length === 1;
    const body =
      g.title === "Ajuste pedido pelo cliente" && single && g.reason ? `“${g.reason}”` : g.batch;
    out.push({
      id: `ap:${key}`,
      kind: "aprovacao",
      title: single ? verb.one(g.names[0]) : verb.many(g.names.length),
      body,
      who: g.who,
      at: g.at,
    });
  }

  for (const t of input.tasks) {
    for (const c of t.comments) {
      if (c.author === SYSTEM_AUTHOR) continue;
      out.push({
        id: `cm:${c.id}`,
        kind: "comentario",
        title: `Comentou em ${t.title}`,
        body: `“${c.text.length > 140 ? `${c.text.slice(0, 139)}…` : c.text}”`,
        who: c.author,
        at: c.createdAt,
      });
    }
  }

  for (const f of input.account.files) {
    out.push({
      id: `fl:${f.id}`,
      kind: "arquivo",
      title: `Enviou ${f.name}`,
      body: folderLabel(f.folder),
      who: f.uploadedBy,
      at: f.createdAt,
    });
  }

  for (const i of input.account.invoices) {
    out.push({
      id: `iv:${i.id}`,
      kind: "financeiro",
      title: `Cobrança de ${monthName(i.competence)} gerada`,
      body: `${formatMoney(i.amount)} · vence ${dayMonth(parseDateKey(i.dueDate) ?? new Date(i.createdAt))}`,
      who: "Financeiro",
      at: i.createdAt,
    });
    if (i.status === "pago" && i.paidAt) {
      out.push({
        id: `pg:${i.id}`,
        kind: "financeiro",
        title: `Pagamento de ${monthName(i.competence)} confirmado`,
        body: `${formatMoney(i.amount)} via ${paymentLabel(i.method).toLowerCase()}.`,
        who: "Financeiro",
        at: i.paidAt,
      });
    }
  }

  for (const e of input.account.events) {
    if (new Date(e.at).getTime() > input.now.getTime()) continue;
    out.push({
      id: `ev:${e.id}`,
      kind: "reuniao",
      title: e.title,
      body: e.place,
      who: e.createdBy,
      at: e.at,
    });
  }

  // Só a agenda depende de "já passou" (acima). O resto já aconteceu — e o
  // relógio do servidor pode estar uns segundos à frente do da tela.
  return out.filter((a) => !Number.isNaN(new Date(a.at).getTime())).sort((a, b) => b.at.localeCompare(a.at));
}

export function filterActivities(list: Activity[], kind: ActivityKind | "tudo"): Activity[] {
  return kind === "tudo" ? list : list.filter((a) => a.kind === kind);
}

/** "HOJE" · "ONTEM" · "ESTA SEMANA" · "ESTE MÊS" · "ANTES" — os cabeçalhos da linha do tempo. */
export function groupActivities(list: Activity[], now: Date): { label: string; items: Activity[] }[] {
  const out: { label: string; items: Activity[] }[] = [];
  for (const a of list) {
    const at = new Date(a.at);
    const days = daysBetween(at, now);
    const label =
      days <= 0
        ? "Hoje"
        : days === 1
          ? "Ontem"
          : days < 7
            ? "Esta semana"
            : monthKey(at) === monthKey(now)
              ? "Este mês"
              : "Antes";
    const last = out[out.length - 1];
    if (last?.label === label) last.items.push(a);
    else out.push({ label, items: [a] });
  }
  return out;
}

/* ========================================================== resumo do mês */

const CLIENT_DECISIONS = new Set(["Aprovada pelo cliente", "Ajuste pedido pelo cliente"]);
const AGENCY_REPLIES = new Set([
  "Marcada como refeita",
  "Enviada para aprovação",
  "Arte enviada",
  "Arte adicionada ao carrossel",
]);

export type MonthSummary = {
  interactions: number;
  /** Tempo médio entre o cliente pedir ajuste e a agência responder, em ms. */
  responseMs: number | null;
  /** Aprovadas ÷ decididas pelo cliente no mês, 0–1. */
  approvalRate: number | null;
  onTime: { done: number; total: number };
};

/**
 * "Resumo do mês": atividades do mês, a resposta média da agência a um
 * pedido de ajuste, a taxa de aprovação das decisões do cliente e as tarefas
 * entregues no prazo entre as que venceram no mês.
 */
export function monthSummary(input: {
  activities: Activity[];
  batches: ActivityBatch[];
  tasks: ActivityTask[];
  now: Date;
}): MonthSummary {
  const key = monthKey(input.now);
  const inMonth = (iso?: string | null) => !!iso && monthKey(new Date(iso)) === key;

  let approved = 0;
  let decided = 0;
  const waits: number[] = [];
  for (const b of input.batches) {
    for (const p of b.pieces) {
      const timeline = p.history.filter((h) => h.at).sort((x, y) => x.at!.localeCompare(y.at!));
      timeline.forEach((h, i) => {
        if (CLIENT_DECISIONS.has(h.title) && inMonth(h.at)) {
          decided++;
          if (h.title === "Aprovada pelo cliente") approved++;
        }
        if (h.title === "Ajuste pedido pelo cliente" && inMonth(h.at)) {
          const reply = timeline.slice(i + 1).find((x) => AGENCY_REPLIES.has(x.title));
          if (reply) waits.push(new Date(reply.at!).getTime() - new Date(h.at!).getTime());
        }
      });
    }
  }

  let done = 0;
  let total = 0;
  for (const t of input.tasks) {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    if (!due || monthKey(due) !== key || t.status === "cancelado") continue;
    const finished = t.status === "concluido";
    if (!finished && due.getTime() > input.now.getTime()) continue; // ainda não venceu
    total++;
    const deadline = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999);
    if (finished && t.completedAt && new Date(t.completedAt).getTime() <= deadline.getTime()) done++;
  }

  return {
    interactions: input.activities.filter((a) => inMonth(a.at)).length,
    responseMs: waits.length ? waits.reduce((s, w) => s + w, 0) / waits.length : null,
    approvalRate: decided ? approved / decided : null,
    onTime: { done, total },
  };
}

/* ======================================================== próxima entrega */

/**
 * "PRÓXIMA ENTREGA": a tarefa aberta do cliente que vence primeiro. Vencida
 * aparece como "Atrasada" — é a que mais importa.
 */
export function nextDelivery(tasks: ActivityTask[], now: Date): { label: string; sub: string } | null {
  const open = tasks
    .filter((t) => t.dueDate && t.status !== "concluido" && t.status !== "cancelado")
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const t = open[0];
  if (!t) return null;
  const due = new Date(t.dueDate!);
  const days = daysBetween(now, due);
  const label = days < 0 ? "Atrasada" : days === 0 ? "Hoje" : days === 1 ? "Amanhã" : dayMonthShort(due);
  return { label, sub: t.title };
}

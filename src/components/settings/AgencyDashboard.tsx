"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  Clock3Icon,
  ClockAlertIcon,
  DownloadIcon,
  HourglassIcon,
  ListTodoIcon,
  LockIcon,
  PackageCheckIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersIcon,
  VideoIcon,
  WalletIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { CLIENT_STATUSES } from "@/lib/clients/constants";
import { competenceLabel, formatMoney, monthName, parseDateKey } from "@/lib/crm/view";
import {
  ON_TIME_GOAL,
  previousMonth,
  type AgendaItem,
  type ApprovalStats,
  type DeliveryLine,
  type FinanceStats,
  type OperationStats,
  type PortfolioStats,
  type TeamStats,
} from "@/lib/dashboard/metrics";
import { PRESENCE_BY_ID } from "@/lib/inbox/constants";
import { lastSeenLabel } from "@/lib/inbox/users";
import { initialsOf } from "@/lib/inbox/view";
import { STATUSES } from "@/lib/tasks/constants";
import type { ClientStatus } from "@/lib/clients/types";
import type { EventKind } from "@/lib/crm/types";
import type { TaskStatus } from "@/lib/tasks/types";
import { Pill, SettingsShell, SmallButton, Sub, type SettingsTab } from "./kit";

/*
 * Configurações › Painel da agência (export "Configurações · Painel da
 * agência"): a agência de uma olhada — operação, aprovação, dinheiro,
 * carteira, entregas, equipe e agenda. Os números chegam prontos do servidor
 * (`lib/dashboard/metrics.ts`); aqui é só desenho.
 *
 * Fora do desenho, a pedido do Felipe: o bloco "NPS médio" da Carteira (a
 * ficha guarda uma nota por cliente, não as respostas) e o "Abrir agenda"
 * (a agenda da agência ainda não existe — está no backlog de ideias).
 */

const STATUS_BAR: Record<TaskStatus, string> = {
  concluido: "bg-bar-1",
  "em-revisao": "bg-bar-2",
  "em-progresso": "bg-bar-3",
  "a-fazer": "bg-bar-4",
  pausado: "bg-bar-5",
  cancelado: "bg-bar-6",
};

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<TaskStatus, string>;
const CLIENT_LABEL = Object.fromEntries(CLIENT_STATUSES.map((s) => [s.id, s.label])) as Record<ClientStatus, string>;

const EVENT: Record<EventKind, { label: string; icon: React.ReactNode }> = {
  reuniao: { label: "Reunião", icon: <UsersIcon size={11} /> },
  gravacao: { label: "Gravação", icon: <VideoIcon size={11} /> },
  entrega: { label: "Entrega", icon: <PackageCheckIcon size={11} /> },
  outro: { label: "Outro", icon: <CalendarIcon size={11} /> },
};

const CYCLE_LABEL = { mensal: "Mensalidade", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" } as const;

const WEEKDAY = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "R$ 184,5 mil" · "R$ 1,2 mi" · "R$ 850" — o valor grande dos cartões. */
export function moneyShort(cents: number): string {
  const v = cents / 100;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (Math.abs(v) >= 1_000_000) return `R$ ${fmt(v / 1_000_000)} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${fmt(v / 1_000)} mil`;
  return formatMoney(cents);
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function AgencyDashboard({
  tabs,
  now: nowIso,
  filters,
  options,
  operation,
  approval,
  finance,
  portfolio,
  delivery,
  team,
  agenda,
  canManageTeam,
  memberPhotos,
}: {
  tabs: SettingsTab[];
  now: string;
  filters: { month: string; clientId: string | null; person: string | null };
  options: { months: string[]; clients: { id: string; name: string }[]; people: string[] };
  operation: OperationStats;
  approval: ApprovalStats;
  /** `null` para quem não vê dinheiro (Gerente): o bloco aparece trancado. */
  finance: FinanceStats | null;
  portfolio: PortfolioStats;
  delivery: { done: number; quota: number; lines: DeliveryLine[] };
  team: TeamStats;
  agenda: AgendaItem[];
  canManageTeam: boolean;
  memberPhotos: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const now = new Date(nowIso);
  const monthLong = monthName(filters.month);
  const prevLong = monthName(previousMonth(filters.month));

  function go(patch: Partial<{ mes: string | null; cliente: string | null; pessoa: string | null }>) {
    const q = new URLSearchParams();
    const next = {
      mes: filters.month,
      cliente: filters.clientId,
      pessoa: filters.person,
      ...patch,
    };
    if (next.mes) q.set("mes", next.mes);
    if (next.cliente) q.set("cliente", next.cliente);
    if (next.pessoa) q.set("pessoa", next.pessoa);
    router.push(`${pathname}?${q.toString()}`);
  }

  function exportCsv() {
    const rows: [string, string | number][] = [
      ["Mês", competenceLabel(filters.month)],
      ["Cliente", options.clients.find((c) => c.id === filters.clientId)?.name ?? "Todos"],
      ["Pessoa", filters.person ?? "Todas"],
      ["Tarefas abertas", operation.open],
      ["Tarefas atrasadas", operation.late],
      ["Concluídas no prazo (%)", operation.onTime ?? ""],
      ...operation.byStatus.map((s): [string, number] => [`Tarefas no mês · ${STATUS_LABEL[s.status]}`, s.count]),
      ["Peças esperando o cliente", approval.pending],
      ["Peças aprovadas no mês", approval.approved],
      ["Peças em ajuste no mês", approval.adjust],
      ["Tempo médio até decidir (dias)", approval.avgDecisionDays ?? ""],
      ["Taxa de ajuste (%)", approval.adjustRate ?? ""],
      ...(finance
        ? ([
            ["Receita mensal recorrente (R$)", (finance.mrr / 100).toFixed(2)],
            ["Recebido no mês (R$)", (finance.received / 100).toFixed(2)],
            ["Faturas em aberto (R$)", (finance.open.cents / 100).toFixed(2)],
            ["Faturas vencidas (R$)", (finance.overdue.cents / 100).toFixed(2)],
          ] as [string, string][])
        : []),
      ["Clientes", portfolio.total],
      ...portfolio.byStatus.map((s): [string, number] => [`Clientes · ${CLIENT_LABEL[s.status]}`, s.count]),
      ["Entregas no mês", `${delivery.done}/${delivery.quota}`],
      ["Membros ativos", team.active],
      ["Convites pendentes", team.invites],
    ];
    const csv = rows.map(([k, v]) => `"${k.replace(/"/g, '""')}";"${String(v).replace(/"/g, '""')}"`).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `painel-${filters.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const onTimeOk = operation.onTime !== null && operation.onTime >= ON_TIME_GOAL;

  return (
    <SettingsShell
      tab="painel"
      tabs={tabs}
      actions={
        <>
          <FilterSelect
            className="hidden lg:flex"
            icon={<CalendarIcon size={14} />}
            label="Mês"
            value={filters.month}
            options={options.months.map((m) => ({ id: m, label: competenceLabel(m) }))}
            onChange={(mes) => go({ mes })}
          />
          <FilterSelect
            className="hidden lg:flex"
            icon={<BriefcaseIcon size={14} />}
            label="Cliente"
            value={filters.clientId ?? ""}
            options={[{ id: "", label: "Todos os clientes" }, ...options.clients.map((c) => ({ id: c.id, label: c.name }))]}
            onChange={(cliente) => go({ cliente: cliente || null })}
          />
          <FilterSelect
            className="hidden lg:flex"
            icon={<UserRoundIcon size={14} />}
            label="Pessoa"
            value={filters.person ?? ""}
            options={[{ id: "", label: "Todas as pessoas" }, ...options.people.map((p) => ({ id: p, label: p }))]}
            onChange={(pessoa) => go({ pessoa: pessoa || null })}
          />
          <SmallButton className="hidden md:flex" icon={<DownloadIcon size={14} />} onClick={exportCsv}>
            Exportar
          </SmallButton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-6">
        {/* Celular e tablet: os filtros descem para cá — no cabeçalho só cabem as abas. */}
        <div className="flex flex-wrap gap-2 lg:hidden">
          <FilterSelect
            icon={<CalendarIcon size={14} />}
            label="Mês"
            value={filters.month}
            options={options.months.map((m) => ({ id: m, label: competenceLabel(m) }))}
            onChange={(mes) => go({ mes })}
          />
          <FilterSelect
            icon={<BriefcaseIcon size={14} />}
            label="Cliente"
            value={filters.clientId ?? ""}
            options={[{ id: "", label: "Todos os clientes" }, ...options.clients.map((c) => ({ id: c.id, label: c.name }))]}
            onChange={(cliente) => go({ cliente: cliente || null })}
          />
          <FilterSelect
            icon={<UserRoundIcon size={14} />}
            label="Pessoa"
            value={filters.person ?? ""}
            options={[{ id: "", label: "Todas as pessoas" }, ...options.people.map((p) => ({ id: p, label: p }))]}
            onChange={(pessoa) => go({ pessoa: pessoa || null })}
          />
        </div>

        {/* A tira de números do topo. */}
        <div className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-rule bg-flow-panel md:grid-cols-3 xl:grid-cols-5">
          <Kpi icon={<ListTodoIcon size={14} />} label="Tarefas abertas" value={String(operation.open)}>
            {plural(operation.created, "criada", "criadas")} em {monthLong}
          </Kpi>
          <Kpi icon={<ClockAlertIcon size={14} />} label="Atrasadas" value={String(operation.late)} dot={operation.late ? "bg-bad" : undefined}>
            Prazo vencido e não concluídas
          </Kpi>
          <Kpi
            icon={<CircleCheckIcon size={14} />}
            label="Concluídas no prazo"
            value={operation.onTime === null ? "—" : `${operation.onTime}%`}
            dot={operation.onTime === null ? undefined : onTimeOk ? "bg-ok" : "bg-warn"}
          >
            Meta da agência: {ON_TIME_GOAL}%
          </Kpi>
          <Kpi icon={<HourglassIcon size={14} />} label="Esperando o cliente" value={String(approval.pending)}>
            {approval.pending === 1 ? "peça" : "peças"} em {plural(approval.waitingBatches, "lote", "lotes")} de aprovação
          </Kpi>
          <Kpi
            icon={<WalletIcon size={14} />}
            label="Receita mensal recorrente"
            locked
            value={finance ? moneyShort(finance.mrr) : "—"}
          >
            {finance ? "Soma dos serviços ativos" : "Só Admin e Financeiro"}
          </Kpi>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row">
          <Panel
            title="Operação"
            note={`Tarefas da agência em ${monthLong}`}
            link={{ href: "/tarefas", label: "Ver tarefas" }}
            className="flex-1"
          >
            <div className="flex flex-col gap-[22px] p-5">
              <div className="flex flex-col gap-3">
                <Head label="Tarefas por status" right={`${operation.inMonth} no mês`} />
                <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-[4px] bg-set-track">
                  {operation.byStatus
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <span
                        key={s.status}
                        title={`${STATUS_LABEL[s.status]}: ${s.count}`}
                        className={cn("h-full", STATUS_BAR[s.status])}
                        style={{ flexGrow: s.count, flexBasis: 0, minWidth: 3 }}
                      />
                    ))}
                </div>
                <div className="grid grid-cols-3 gap-y-3 sm:grid-cols-6">
                  {operation.byStatus.map((s) => (
                    <div key={s.status} className="flex flex-col gap-[3px]">
                      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                        <span className={cn("h-2 w-2 rounded-[2px]", STATUS_BAR[s.status])} />
                        {STATUS_LABEL[s.status]}
                      </span>
                      <span className="text-[15px] font-semibold text-fg-soft">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="h-px bg-set-line" />
              <div className="flex flex-col gap-3">
                <Head label="Carga por pessoa" right="tarefas abertas" />
                {operation.load.length === 0 ? (
                  <Empty>Nenhuma tarefa aberta com responsável.</Empty>
                ) : (
                  operation.load.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="flex w-[130px] shrink-0 items-center gap-2">
                        <MiniAvatar name={p.name} photo={memberPhotos[p.name]} />
                        <span className="truncate text-[12px] text-fg-3">{p.name}</span>
                      </span>
                      <Track ratio={p.open / operation.load[0].open} className={i === 0 ? "bg-fg-soft" : "bg-bar-mid"} />
                      <span className="w-9 shrink-0 text-right text-[12px] font-semibold text-fg-soft">{p.open}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Aprovação" note="Peças enviadas aos clientes" className="xl:w-[360px] xl:shrink-0">
            <div className="flex flex-col gap-[18px] p-5">
              <div className="grid grid-cols-3 gap-2">
                <Count icon={<HourglassIcon size={12} />} label="Pendentes" value={approval.pending} />
                <Count icon={<CheckIcon size={12} />} label="Aprovadas" value={approval.approved} />
                <Count icon={<RotateCcwIcon size={12} />} label="Em ajuste" value={approval.adjust} />
              </div>
              <div className="flex flex-col">
                <Metric
                  label="Tempo médio até o cliente decidir"
                  sub={decisionDelta(approval.avgDecisionDays, approval.prevAvgDecisionDays, prevLong)}
                  value={approval.avgDecisionDays === null ? "—" : `${String(approval.avgDecisionDays).replace(".", ",")} ${approval.avgDecisionDays === 1 ? "dia" : "dias"}`}
                />
                <Metric
                  label="Taxa de ajuste"
                  sub="peças que voltaram para a equipe"
                  value={approval.adjustRate === null ? "—" : `${approval.adjustRate}%`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-medium text-fg-3">Lotes esperando o cliente</span>
                {approval.waiting.length === 0 ? (
                  <Empty>Nenhum lote esperando decisão.</Empty>
                ) : (
                  approval.waiting.map((w) => (
                    <div key={w.id} className="flex items-center gap-2.5 rounded-[10px] bg-surface px-2.5 py-2">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] font-medium text-fg-soft">{w.client}</span>
                        <span className="truncate text-[11px] text-set-hint">
                          {w.label} · {plural(w.pending, "peça", "peças")}
                        </span>
                      </span>
                      <Pill tone={w.days >= 3 ? "warn" : "neutral"}>{w.days === 0 ? "hoje" : `há ${plural(w.days, "dia", "dias")}`}</Pill>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row">
          <FinancePanel finance={finance} month={filters.month} />
          <PortfolioPanel portfolio={portfolio} />
        </div>

        <div className="flex flex-col gap-4 xl:flex-row">
          <Panel title="Entregas" note={`Contratado × entregue em ${monthLong}`} className="flex-1">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-end gap-2.5 pb-1">
                <span className="text-[28px] font-semibold leading-none tracking-[-0.6px] text-fg">{delivery.done}</span>
                <span className="text-[12px] text-muted">
                  de {plural(delivery.quota, "entrega", "entregas")} no mês · {pct(delivery.done, delivery.quota)}%
                </span>
              </div>
              <span className="h-px bg-set-line" />
              {delivery.lines.length === 0 ? (
                <Empty>Nenhum serviço com meta de entregas. A meta fica na aba Serviços da ficha do cliente.</Empty>
              ) : (
                delivery.lines.map((l) => <DeliveryRow key={l.unit} line={l} />)
              )}
            </div>
          </Panel>
          <TeamPanel team={team} canManageTeam={canManageTeam} now={now} memberPhotos={memberPhotos} />
        </div>

        <Panel title="Agenda" note="Próximos eventos da agência">
          {agenda.length === 0 ? (
            <div className="p-5">
              <Empty>Nenhum evento marcado. Os eventos entram pela ficha de cada cliente.</Empty>
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {agenda.map((e, i) => (
                <EventCard key={e.id} event={e} now={now} first={i === 0} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </SettingsShell>
  );
}

function decisionDelta(now: number | null, prev: number | null, prevLong: string): string {
  if (now === null) return "nenhuma decisão no mês";
  if (prev === null) return `sem comparação com ${prevLong}`;
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return `igual a ${prevLong}`;
  return `${d > 0 ? "+" : "−"}${String(Math.abs(d)).replace(".", ",")} dia vs. ${prevLong}`;
}

/* ================================================================ peças */

function FilterSelect({
  icon,
  label,
  value,
  options,
  onChange,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const current = options.find((o) => o.id === value)?.label ?? options[0]?.label;
  return (
    <label
      className={cn(
        "relative flex max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-chip border border-border bg-flow-btn px-3 py-2 text-[12px] font-medium text-fg-soft hover:bg-surface-2",
        className,
      )}
    >
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="truncate">{current}</span>
      <ChevronDownIcon size={13} className="shrink-0 text-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Kpi({
  icon,
  label,
  value,
  dot,
  locked = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dot?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-r border-badge-neutral px-5 py-[18px] [&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(3n)]:border-r xl:last:border-r-0">
      <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <span className="text-muted">{icon}</span>
        {label}
        {locked && <LockIcon size={12} className="text-faint" />}
      </span>
      <span className="text-[24px] font-semibold leading-none tracking-[-0.6px] text-fg md:text-[28px]">{value}</span>
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
        {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />}
        {children}
      </span>
    </div>
  );
}

function Panel({
  title,
  note,
  link,
  aside,
  className,
  children,
}: {
  title: string;
  note: string;
  link?: { href: string; label: string };
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-rule bg-flow-panel", className)}>
      <header className="flex items-center gap-2.5 border-b border-set-line px-5 pb-3.5 pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
          <p className="text-[12px] text-muted">{note}</p>
        </div>
        {aside}
        {link && (
          <Link href={link.href} className="flex shrink-0 items-center gap-1 text-[12px] text-fg-3 hover:text-fg-soft">
            {link.label} <ArrowRightIcon size={13} className="text-muted" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Head({ label, right }: { label: string; right?: string }) {
  return (
    <div className="flex items-end justify-between">
      <span className="text-[12px] font-medium text-fg-3">{label}</span>
      {right && <span className="text-[12px] text-set-hint">{right}</span>}
    </div>
  );
}

function Track({ ratio, className }: { ratio: number; className: string }) {
  return (
    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-set-track">
      <span className={cn("block h-full rounded-[4px]", className)} style={{ width: `${Math.max(2, Math.min(1, ratio) * 100)}%` }} />
    </span>
  );
}

function MiniAvatar({ name, photo, size = 22 }: { name: string; photo?: string | null; size?: 22 | 24 | 28 }) {
  const cls = size === 28 ? "h-7 w-7 text-[10px]" : size === 24 ? "h-6 w-6 text-[9px]" : "h-[22px] w-[22px] text-[9px]";
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={cn("shrink-0 rounded-full object-cover", cls)} />;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-border font-semibold text-fg-soft", cls)}>
      {initialsOf(name)}
    </span>
  );
}

function Count({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-thumb border border-badge-neutral bg-surface p-3">
      <span className="flex items-center gap-[5px] text-[11px] text-muted">
        {icon}
        {label}
      </span>
      <span className="text-[22px] font-semibold leading-none text-fg">{value}</span>
    </div>
  );
}

function Metric({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-set-line py-2.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12px] text-fg-3">{label}</span>
        <span className="text-[11px] text-set-hint">{sub}</span>
      </span>
      <span className="shrink-0 text-[18px] font-semibold text-fg">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-set-hint">{children}</p>;
}

/* =========================================================== financeiro */

function FinancePanel({ finance, month }: { finance: FinanceStats | null; month: string }) {
  const monthLong = competenceLabel(month).split(" ")[0];
  const access = (
    <span className="flex shrink-0 items-center gap-1.5 rounded-mark border border-border bg-flow-btn px-2 py-1 text-[11px] font-medium text-fg-3">
      <LockIcon size={12} className="text-muted" /> Só Admin e Financeiro
    </span>
  );
  if (!finance) {
    return (
      <Panel title="Financeiro" note="Receita, faturas e contratos" aside={access} className="flex-1">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
          <LockIcon size={18} className="text-set-hint" />
          <p className="max-w-[320px] text-[12px] text-muted">
            Os números de dinheiro aparecem só para Admin e Financeiro. Peça a um deles se precisar.
          </p>
        </div>
      </Panel>
    );
  }
  const total = Math.max(finance.expected, finance.received + finance.open.cents + finance.overdue.cents, 1);
  const segments = [
    { key: "Recebido", cents: finance.received, cls: "bg-fg-soft" },
    { key: "Em aberto", cents: finance.open.cents, cls: "bg-bar-4" },
    { key: "Vencido", cents: finance.overdue.cents, cls: "bg-bad" },
  ];
  return (
    <Panel title="Financeiro" note={`${monthLong} · valores com serviços ativos`} aside={access} className="flex-1">
      <div className="grid grid-cols-2 border-b border-set-line md:grid-cols-4">
        <Money label="Receita mensal recorrente" value={moneyShort(finance.mrr)}>
          {plural(finance.payingClients, "cliente ativo", "clientes ativos")}
        </Money>
        <Money label="Recebido no mês" value={moneyShort(finance.received)} dot="bg-ok">
          {pct(finance.received, finance.expected)}% do previsto
        </Money>
        <Money label="Faturas em aberto" value={moneyShort(finance.open.cents)} dot="bg-warn">
          {plural(finance.open.count, "fatura", "faturas")}
        </Money>
        <Money label="Faturas vencidas" value={moneyShort(finance.overdue.cents)} dot="bg-bad">
          {plural(finance.overdue.count, "fatura", "faturas")} · {plural(finance.overdue.clients, "cliente", "clientes")}
        </Money>
      </div>
      <div className="flex flex-col gap-2 border-b border-set-line px-5 py-3.5">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-[12px] text-fg-3">Recebido × previsto no mês</span>
          <span className="text-[12px] text-muted">
            {moneyShort(finance.received)} de {moneyShort(finance.expected)}
          </span>
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-[4px] bg-set-track">
          {segments
            .filter((s) => s.cents > 0)
            .map((s) => (
              <span key={s.key} className={cn("h-full", s.cls)} style={{ width: `${(s.cents / total) * 100}%` }} />
            ))}
        </div>
        <div className="flex gap-4">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={cn("h-2 w-2 rounded-[2px]", s.cls)} />
              {s.key}
            </span>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col gap-1 border-b border-set-line px-5 pb-4 pt-3.5 md:border-b-0 md:border-r">
          <span className="pb-1 text-[12px] font-medium text-fg-3">Próximos vencimentos</span>
          {finance.upcoming.length === 0 ? (
            <Empty>Nenhuma fatura em aberto para vencer.</Empty>
          ) : (
            finance.upcoming.map((u, i) => {
              const due = parseDateKey(u.dueDate);
              return (
                <Link
                  key={`${u.clientId}-${i}`}
                  href={`/clientes/${u.clientId}?aba=financeiro`}
                  className="flex items-center gap-2.5 py-[7px] hover:opacity-80"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[12.5px] font-medium text-fg-soft">{u.client}</span>
                    <span className="text-[11px] text-set-hint">
                      {CYCLE_LABEL[u.cycle]} · vence {due ? `${String(due.getDate()).padStart(2, "0")} ${MONTH_SHORT[due.getMonth()]}` : u.dueDate}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-medium text-fg-soft">{formatMoney(u.amount)}</span>
                </Link>
              );
            })
          )}
        </div>
        <div className="flex flex-col gap-1 px-5 pb-4 pt-3.5">
          <span className="pb-1 text-[12px] font-medium text-fg-3">Fidelidade terminando</span>
          {finance.fidelity.length === 0 ? (
            <Empty>Nenhum contrato termina a fidelidade nos próximos 60 dias.</Empty>
          ) : (
            finance.fidelity.map((f) => (
              <Link key={f.clientId} href={`/clientes/${f.clientId}`} className="flex items-center gap-2.5 py-[7px] hover:opacity-80">
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="truncate text-[12.5px] font-medium text-fg-soft">{f.client}</span>
                  <span className="text-[11px] text-set-hint">Contrato de {plural(f.months, "mês", "meses")}</span>
                </span>
                <Pill tone={f.days <= 30 ? "warn" : "neutral"}>{f.days === 0 ? "hoje" : `em ${plural(f.days, "dia", "dias")}`}</Pill>
              </Link>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

function Money({ label, value, dot, children }: { label: string; value: string; dot?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-r border-set-line px-5 py-4 even:border-r-0 md:border-b-0 md:even:border-r md:last:border-r-0 [&:nth-child(3)]:border-b-0 [&:nth-child(4)]:border-b-0">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="text-[19px] font-semibold tracking-[-0.3px] text-fg">{value}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-set-hint">
        {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
        {children}
      </span>
    </div>
  );
}

/* ============================================================== carteira */

function PortfolioPanel({ portfolio }: { portfolio: PortfolioStats }) {
  const max = Math.max(1, ...portfolio.byStatus.map((s) => s.count));
  const fill = (status: ClientStatus) => (status === "renovacao" ? "bg-warn" : status === "risco" ? "bg-bad" : "bg-bar-soft");
  return (
    <Panel title="Carteira" note="Clientes da agência" className="xl:w-[360px] xl:shrink-0">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1 rounded-thumb border border-badge-neutral bg-surface p-3">
          <span className="text-[11px] text-muted">Clientes sem fluxo</span>
          <span className="text-[24px] font-semibold leading-tight text-fg">{portfolio.withoutFlow}</span>
          <Link href="/configuracoes/fluxos" className="flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-soft">
            Definir fluxo <ArrowRightIcon size={11} className="text-muted" />
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <Head label="Clientes por status" right={`${portfolio.total} no total`} />
          {portfolio.byStatus.map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className="w-[78px] shrink-0 text-[12px] text-fg-3">{CLIENT_LABEL[s.status]}</span>
              <Track ratio={s.count / max} className={fill(s.status)} />
              <span className="w-6 shrink-0 text-right text-[12px] font-semibold text-fg-soft">{s.count}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-fg-3">Em risco</span>
          {portfolio.atRisk.length === 0 ? (
            <Empty>Nenhum cliente em risco agora.</Empty>
          ) : (
            portfolio.atRisk.map((r) => (
              <Link
                key={r.clientId}
                href={`/clientes/${r.clientId}`}
                className="flex items-center gap-2.5 rounded-[10px] bg-surface px-2.5 py-2 hover:bg-surface-2"
              >
                <TriangleAlertIcon size={13} className="shrink-0 text-bad" />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-[12.5px] font-medium text-fg-soft">{r.client}</span>
                  <span className="truncate text-[11px] text-set-hint">{r.reason}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ============================================================== entregas */

function DeliveryRow({ line }: { line: DeliveryLine }) {
  const complete = line.quota > 0 && line.done >= line.quota;
  const unit = line.unit.charAt(0).toUpperCase() + line.unit.slice(1);
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-end justify-between">
        <span className="text-[12.5px] text-fg-soft">{unit}</span>
        <span className="flex items-end gap-1">
          <span className="text-[12.5px] font-semibold text-fg">
            {line.done}/{line.quota}
          </span>
          <span className={cn("text-[11px]", complete ? "text-ok-fg" : "text-set-hint")}>
            {complete ? "completo" : `${pct(line.done, line.quota)}%`}
          </span>
        </span>
      </div>
      {line.quota <= 40 ? (
        <div className="flex h-1.5 gap-0.5">
          {Array.from({ length: line.quota }, (_, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-[2px]", i < line.done ? (complete ? "bg-ok" : "bg-bar-unit") : "bg-badge-neutral")}
            />
          ))}
        </div>
      ) : (
        <Track ratio={line.done / line.quota} className={complete ? "bg-ok" : "bg-bar-unit"} />
      )}
    </div>
  );
}

/* ================================================================ equipe */

function TeamPanel({
  team,
  canManageTeam,
  now,
  memberPhotos,
}: {
  team: TeamStats;
  canManageTeam: boolean;
  now: Date;
  memberPhotos: Record<string, string>;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: "ativo" | "arquivado", name: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível responder o pedido.");
      toast(status === "ativo" ? `${name} entrou no time.` : `Pedido de ${name} recusado.`);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Não foi possível responder o pedido.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Equipe" note="Pessoas e acessos" link={{ href: "/equipe", label: "Membros" }} className="flex-1">
      <div className="grid grid-cols-3 border-b border-set-line">
        {[
          { label: "Membros ativos", value: team.active },
          { label: "Online agora", value: team.online, dot: true },
          { label: "Convites pendentes", value: team.invites },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1 border-r border-set-line px-5 py-3.5 last:border-r-0">
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
              {k.dot && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
              {k.label}
            </span>
            <span className="text-[22px] font-semibold text-fg">{k.value}</span>
          </div>
        ))}
      </div>
      {team.requests.length > 0 && (
        <>
          <Sub label="Pedidos de entrada pelo domínio" right={`${team.requests.length} esperando`} />
          {team.requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2.5 border-b border-set-line px-5 py-2.5">
              <MiniAvatar name={r.name} size={28} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[12.5px] font-medium text-fg-soft">{r.name}</span>
                <span className="truncate text-[11px] text-set-hint">
                  {r.email} · {lastSeenLabel(r.createdAt, now.getTime())}
                </span>
              </span>
              {canManageTeam && (
                <span className="flex gap-2">
                  <SmallButton disabled={busy === r.id} onClick={() => void decide(r.id, "arquivado", r.name)}>
                    Recusar
                  </SmallButton>
                  <SmallButton
                    variant="primary"
                    disabled={busy === r.id}
                    icon={<CheckIcon size={14} />}
                    onClick={() => void decide(r.id, "ativo", r.name)}
                  >
                    Aprovar
                  </SmallButton>
                </span>
              )}
            </div>
          ))}
        </>
      )}
      <Sub label="Último acesso" />
      <div className="flex flex-col px-5 pb-3 pt-1.5">
        {team.lastSeen.length === 0 ? (
          <div className="py-2">
            <Empty>Ninguém entrou ainda.</Empty>
          </div>
        ) : (
          team.lastSeen.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 py-1.5">
              <span className="relative shrink-0">
                <MiniAvatar name={m.name} photo={m.photoUrl ?? memberPhotos[m.name]} size={24} />
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-[9px] w-[9px] rounded-full border border-flow-panel"
                  style={{ background: PRESENCE_BY_ID[m.presence].color }}
                />
              </span>
              <span className="truncate text-[12.5px] font-medium text-fg-soft">{m.name}</span>
              {m.title && <span className="truncate text-[11.5px] text-set-hint">{m.title}</span>}
              <span className="ml-auto shrink-0 text-[11.5px] text-muted">{lastSeenLabel(m.lastSeenAt, now.getTime())}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/* ================================================================ agenda */

function EventCard({ event, now, first }: { event: AgendaItem; now: Date; first: boolean }) {
  const at = new Date(event.at);
  const today = at.toDateString() === now.toDateString();
  const tomorrow = at.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString();
  const kind = EVENT[event.kind];
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[14px] border p-3.5",
        first ? "border-border-strong bg-surface-2" : "border-badge-neutral bg-surface",
      )}
    >
      <div className="flex justify-between gap-2">
        <div className="flex flex-col">
          <span className={cn("text-[10.5px] font-semibold tracking-[0.6px]", today ? "text-fg-soft" : "text-set-hint")}>
            {today ? "HOJE" : tomorrow ? "AMANHÃ" : WEEKDAY[at.getDay()]}
          </span>
          <span className="flex items-end gap-1">
            <span className="text-[24px] font-semibold leading-tight text-fg">{at.getDate()}</span>
            <span className="pb-1 text-[12px] text-muted">{MONTH_SHORT[at.getMonth()]}</span>
          </span>
        </div>
        <span className="flex h-fit items-center gap-[5px] rounded-pill border border-border bg-badge-neutral px-2 py-[3px] text-[11px] font-medium text-fg-3">
          {kind.icon}
          {kind.label}
        </span>
      </div>
      <div className="flex flex-col gap-[3px]">
        <span className="text-[12.5px] font-medium text-fg-soft">{event.title}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-set-hint">
          <Clock3Icon size={11} className="shrink-0" />
          {time} · {event.client}
        </span>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/Toast";
import type { Client } from "@/lib/clients/types";
import { ACTIVITY_FILTERS } from "@/lib/crm/constants";
import type { Activity, ActivityKind, ClientAccount } from "@/lib/crm/types";
import {
  activityTime,
  filterActivities,
  formatDuration,
  formatNps,
  groupActivities,
  monthlyTotal,
  monthSummary,
  nextInvoice,
  upcomingEvents,
  type ActivityBatch,
  type ActivityTask,
} from "@/lib/crm/view";
import { Clock3Icon, PlusIcon, SmileIcon, ThumbsUpIcon, XIcon } from "@/components/icons";
import { crmApi } from "./api";
import { EventModal } from "./modals";
import { ActivityTile } from "./parts";

/** Atividades — o quinto quadro do export: a linha do tempo, o resumo do mês e a agenda. */
export function ActivityTab({
  client,
  account,
  activities,
  batches,
  tasks,
  now,
  onChange,
}: {
  client: Client;
  account: ClientAccount;
  activities: Activity[];
  batches: ActivityBatch[];
  tasks: ActivityTask[];
  now: Date;
  onChange: (a: ClientAccount) => void;
}) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<ActivityKind | "tudo">("tudo");
  const [adding, setAdding] = useState(false);
  const [limit, setLimit] = useState(40);

  const list = useMemo(() => filterActivities(activities, filter), [activities, filter]);
  const groups = useMemo(() => groupActivities(list.slice(0, limit), now), [list, limit, now]);
  const summary = useMemo(() => monthSummary({ activities, batches, tasks, now }), [activities, batches, tasks, now]);
  const next = nextInvoice(account.invoices, monthlyTotal(account.services), client.billingDay, now);
  const upcoming = upcomingEvents(account.events, next, now, 5);

  return (
    <div className="flex flex-col gap-4 xl:min-h-full xl:flex-row">
      {/* Filtros + linha do tempo */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="-mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filtrar atividades">
          {ACTIVITY_FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(f.id);
                  setLimit(40);
                }}
                className={cn(
                  "shrink-0 rounded-pill border px-3.5 py-[7px] text-[12.5px] font-medium transition-colors",
                  on ? "border-transparent bg-border text-fg" : "border-rule bg-flow-btn text-muted hover:text-fg-soft",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <section className="flex flex-col rounded-tile border border-rule bg-flow-btn px-[18px] pb-[18px] pt-1.5 xl:flex-1">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">
              {filter === "tudo" ? "Nada aconteceu com este cliente ainda." : "Nada deste tipo por enquanto."}
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="flex flex-col">
                <h3 className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.6px] text-label">{g.label}</h3>
                <ol className="flex flex-col">
                  {g.items.map((a) => (
                    <li key={a.id} className="flex gap-3 border-b border-rule-soft py-[11px] last:border-b-0">
                      <ActivityTile kind={a.kind} />
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="text-[13px] font-medium text-fg-soft">{a.title}</span>
                        {a.body && <span className="text-[12.5px] leading-[17px] text-muted">{a.body}</span>}
                        <span className="text-[11.5px] text-label">
                          {a.who} · {activityTime(a.at, now)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
          {list.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 40)}
              className="mt-3 self-center rounded-pill border border-rule px-3.5 py-1.5 text-[12px] font-medium text-muted hover:text-fg-soft"
            >
              Ver mais antigas
            </button>
          )}
        </section>
      </div>

      {/* Resumo do mês · próximos eventos */}
      <div className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">
        <section className="flex flex-col gap-3.5 rounded-tile border border-rule bg-flow-btn p-[18px]">
          <h2 className="text-[14px] font-semibold text-fg-soft">Resumo do mês</h2>
          <div className="flex gap-3">
            <Stat value={String(summary.interactions)} label="Interações" />
            <Stat value={formatDuration(summary.responseMs)} label="Resp. média" />
          </div>
          <SummaryRow
            icon={<ThumbsUpIcon size={15} />}
            label="Taxa de aprovação"
            value={summary.approvalRate === null ? "—" : `${Math.round(summary.approvalRate * 100)}%`}
          />
          <SummaryRow
            icon={<Clock3Icon size={15} />}
            label="Tarefas no prazo"
            value={summary.onTime.total ? `${summary.onTime.done}/${summary.onTime.total}` : "—"}
          />
          <SummaryRow
            icon={<SmileIcon size={15} />}
            label="Satisfação (NPS)"
            value={client.nps === null ? "—" : formatNps(client.nps)}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-tile border border-rule bg-flow-btn p-[18px] xl:flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-fg-soft">Próximos eventos</h2>
            <button
              type="button"
              aria-label="Marcar evento"
              title="Marcar evento"
              onClick={() => setAdding(true)}
              className="tap flex h-7 w-7 items-center justify-center rounded-mark text-muted transition-colors hover:bg-border hover:text-fg-soft"
            >
              <PlusIcon size={14} />
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-[12px] text-muted">Nada marcado. Use o + para marcar uma reunião ou gravação.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((e) => (
                <li key={e.id} className="group flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-menu bg-surface-2">
                    <span className="text-[16px] font-bold leading-none text-fg">{e.day}</span>
                    <span className="mt-0.5 text-[9.5px] font-semibold tracking-[0.5px] text-muted">{e.month}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[12.5px] font-medium text-fg-soft">{e.title}</span>
                    <span className="truncate text-[11.5px] text-muted">{e.sub}</span>
                  </span>
                  {e.id !== "cobranca" && (
                    <button
                      type="button"
                      aria-label={`Desmarcar ${e.title}`}
                      title="Desmarcar"
                      onClick={async () => {
                        try {
                          onChange(await crmApi.removeEvent(client.id, e.id));
                          toast("Evento desmarcado.");
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Não foi possível desmarcar.", "error");
                        }
                      }}
                      className="text-dim opacity-0 transition-opacity hover:text-fg-soft focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <XIcon size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {adding && (
        <EventModal
          clientName={client.name}
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            try {
              onChange(await crmApi.addEvent(client.id, input));
              setAdding(false);
              toast("Evento marcado.");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Não foi possível marcar.", "error");
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[3px] rounded-menu bg-surface-2 p-3">
      <span className="truncate text-[20px] font-semibold text-fg">{value}</span>
      <span className="truncate text-[11.5px] text-muted">{label}</span>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px]">
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1 text-muted">{label}</span>
      <span className="font-medium text-fg-soft">{value}</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUS_BY_ID } from "@/lib/tasks/constants";
import {
  groupTasks,
  isOverdue,
  type ColumnKey,
  type Group,
  type GroupKey,
} from "@/lib/tasks/view";
import { PRIORITY_BY_ID, isRealPriority } from "@/lib/tasks/priority";
import { formatShortDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { StatusMenu } from "./StatusMenu";
import { ActionMenu } from "./ActionMenu";
import { PriorityBars } from "./TaskModal";
import { TrashIcon, ExternalLinkIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Lista · tabela. O corpo é transparente desde o design system v2 (o export
 * "List View" trocou o fundo/borda do List Body por transparente).
 */
export function TaskTable({
  groups,
  subgroupKey,
  columns,
  perGroup,
  onOpen,
  onStatusChange,
  onDelete,
}: {
  groups: Group[];
  subgroupKey: GroupKey;
  columns: ColumnKey[];
  perGroup: number | "todas";
  onOpen: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
}) {
  const has = (c: ColumnKey) => columns.includes(c);
  const grouped = groups.length > 1 || groups[0]?.key !== "todas";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-3">
        <div className="flex-1 text-[12px] font-semibold tracking-[0.3px] text-muted">
          TAREFA
        </div>
        {has("id") && (
          <div className="w-[72px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            ID
          </div>
        )}
        {has("status") && (
          <div className="w-[150px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            STATUS
          </div>
        )}
        {has("assignee") && (
          <div className="w-[130px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            RESPONSÁVEL
          </div>
        )}
        {has("priority") && (
          <div className="w-[110px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            PRIORIDADE
          </div>
        )}
        {has("labels") && (
          <div className="w-[150px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            ETIQUETAS
          </div>
        )}
        {has("dueDate") && (
          <div className="w-[90px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            PRAZO
          </div>
        )}
        {has("createdAt") && (
          <div className="w-[90px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
            CRIADO
          </div>
        )}
        <div className="w-8 shrink-0" />
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map((g) => (
          <section key={g.key}>
            {grouped && (
              <header className="flex items-center gap-2 bg-surface/60 px-4 py-2">
                <h3 className="text-[12px] font-semibold tracking-[0.3px] text-fg-3">
                  {g.label.toUpperCase()}
                </h3>
                <span className="rounded-pill bg-border px-2 py-0.5 text-[11px] font-semibold text-fg-soft">
                  {g.tasks.length}
                </span>
              </header>
            )}

            {g.tasks.length === 0 ? (
              <p className="border-b border-border px-4 py-3 text-[13px] text-muted">
                Nenhuma tarefa neste grupo.
              </p>
            ) : subgroupKey === "nenhum" ? (
              <Rows
                tasks={g.tasks}
                perGroup={perGroup}
                columns={columns}
                onOpen={onOpen}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
              />
            ) : (
              groupTasks(g.tasks, subgroupKey).map((sg) => (
                <div key={sg.key}>
                  <p className="px-4 py-1.5 pl-6 text-[11px] font-medium tracking-[0.3px] text-muted">
                    {sg.label.toUpperCase()} · {sg.tasks.length}
                  </p>
                  <Rows
                    tasks={sg.tasks}
                    perGroup={perGroup}
                    columns={columns}
                    onOpen={onOpen}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
                </div>
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Rows({
  tasks,
  perGroup,
  columns,
  onOpen,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[];
  perGroup: number | "todas";
  columns: ColumnKey[];
  onOpen: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = perGroup === "todas" || expanded ? tasks.length : perGroup;
  const visible = tasks.slice(0, limit);
  const hidden = tasks.length - visible.length;
  const has = (c: ColumnKey) => columns.includes(c);

  return (
    <>
      {visible.map((t, i) => (
        <div
          key={t.id}
          onClick={() => onOpen(t)}
          style={{ ["--d" as string]: i }}
          className="stagger-item group flex cursor-pointer items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_BY_ID[t.status].dot }}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[14px] font-medium text-fg">
                {t.title}
              </span>
              {has("client") && (
                <span className="truncate text-[12px] text-muted">
                  {t.client || "—"}
                </span>
              )}
            </div>
          </div>
          {has("id") && (
            <div className="w-[72px] shrink-0 truncate text-[12px] text-muted">
              {t.id}
            </div>
          )}
          {has("status") && (
            <div className="w-[150px] shrink-0">
              <StatusMenu status={t.status} onSelect={(s) => onStatusChange(t, s)} />
            </div>
          )}
          {has("assignee") && (
            <div className="w-[130px] shrink-0">
              <Avatar initial={t.assignee} />
            </div>
          )}
          {has("priority") && (
            <div className="flex w-[110px] shrink-0 items-center gap-2">
              {isRealPriority(t.priority) ? (
                <>
                  <PriorityBars bars={PRIORITY_BY_ID[t.priority].bars} />
                  <span className="truncate text-[13px] text-fg-2">
                    {PRIORITY_BY_ID[t.priority].label}
                  </span>
                </>
              ) : (
                <span className="text-[13px] text-muted">—</span>
              )}
            </div>
          )}
          {has("labels") && (
            <div className="flex w-[150px] shrink-0 flex-wrap gap-1 overflow-hidden">
              {t.labels.length === 0 ? (
                <span className="text-[13px] text-muted">—</span>
              ) : (
                t.labels.slice(0, 2).map((l) => (
                  <span
                    key={l}
                    className="rounded-pill bg-border px-2 py-0.5 text-[11px] text-fg-3"
                  >
                    #{l}
                  </span>
                ))
              )}
              {t.labels.length > 2 && (
                <span className="text-[11px] text-muted">+{t.labels.length - 2}</span>
              )}
            </div>
          )}
          {has("dueDate") && (
            <div
              className={cn(
                "w-[90px] shrink-0 text-[13px]",
                isOverdue(t) ? "font-semibold text-fg" : "text-muted",
              )}
              title={isOverdue(t) ? "Prazo vencido" : undefined}
            >
              {t.dueDate ? formatShortDate(t.dueDate) : "—"}
            </div>
          )}
          {has("createdAt") && (
            <div className="w-[90px] shrink-0 text-[13px] text-muted">
              {formatShortDate(t.createdAt)}
            </div>
          )}
          {/*
             * A caixa continua com a medida antiga (32x28) e o botão de 40px
             * sobra por cima dela: o alvo de toque cresce sem esticar a altura
             * da linha nem empurrar as colunas.
             */}
            <div className="flex h-7 w-8 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <ActionMenu
              items={[
                {
                  label: "Abrir",
                  icon: <ExternalLinkIcon size={15} />,
                  onSelect: () => onOpen(t),
                },
                {
                  label: "Excluir",
                  icon: <TrashIcon size={15} />,
                  danger: true,
                  onSelect: () => onDelete(t),
                },
              ]}
            />
          </div>
        </div>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full border-b border-border px-4 py-2.5 text-left text-[12px] text-muted transition-colors hover:text-fg-soft"
        >
          Ver mais {hidden} {hidden === 1 ? "tarefa" : "tarefas"}
        </button>
      )}
    </>
  );
}

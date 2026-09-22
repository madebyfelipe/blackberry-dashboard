"use client";

import { useState } from "react";
import type { Task } from "@/lib/tasks/types";
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
import { Badge, Chip } from "@/components/ui/Badge";
import {
  Cell as ColumnCell,
  Checkbox,
  ColumnsProvider,
  HeadCell,
  TableBody,
  TableFrame,
  TableHead,
  TableRow,
} from "@/components/ui/DataTable";
import { useColumnWidths } from "@/components/ui/useColumnWidths";
import { tableMinWidth, type ColumnSpec } from "@/lib/ui/columns";
import { EntityMark, PersonChip } from "@/components/ui/Mark";
import { FieldLabel } from "@/components/ui/Screen";
import { ChevronDownIcon } from "@/components/icons";
import { PriorityBars } from "./PriorityBars";
import { cn } from "@/lib/cn";

/*
 * Tarefas · Lista, no design system v3 (export "Tarefas · Painel (Lista)").
 *
 * As medidas são o contrato do desenho: cabeçalho de 40px, linha de 44px,
 * 16px de respiro lateral e de espaço entre células, TAREFA crescendo e as
 * demais colunas com largura fixa. A linha inteira abre a tarefa; a caixa de
 * seleção é a única parte dela que não abre (ela seleciona).
 *
 * Quais colunas aparecem continua vindo do menu "Personalizar"
 * (`lib/tasks/view.ts`) — o desenho mostra o conjunto padrão. A largura de
 * cada uma começa na medida do export e a divisória do cabeçalho arrasta (ver
 * `lib/ui/columns.ts`).
 */

/** A célula TAREFA: cresce até alguém arrastá-la. */
const TAREFA: ColumnSpec = {
  id: "tarefa",
  label: "Tarefa",
  width: 240,
  flex: true,
};

/** Largura e rótulo de cada coluna opcional, na ordem em que o export as põe. */
const COLUMNS: Record<VisibleColumnKey, ColumnSpec> = {
  status: { id: "status", label: "Status", width: 130 },
  assignee: { id: "responsavel", label: "Responsável", width: 150 },
  dueDate: { id: "prazo", label: "Prazo", width: 100 },
  priority: { id: "prioridade", label: "Prioridade", width: 120 },
  labels: { id: "etiquetas", label: "Etiquetas", width: 150 },
  createdAt: { id: "criado", label: "Criado", width: 100 },
  id: { id: "id", label: "ID", width: 80 },
};

/** `client` não tem coluna própria: ele é a segunda linha da célula TAREFA. */
type VisibleColumnKey = Exclude<ColumnKey, "client">;

const ORDER: VisibleColumnKey[] = [
  "status",
  "assignee",
  "dueDate",
  "priority",
  "labels",
  "createdAt",
  "id",
];

const ALL_SPECS: ColumnSpec[] = [TAREFA, ...ORDER.map((c) => COLUMNS[c])];

export function TaskTable({
  groups,
  subgroupKey,
  columns,
  perGroup,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  someSelected,
  onOpen,
}: {
  groups: Group[];
  subgroupKey: GroupKey;
  columns: ColumnKey[];
  perGroup: number | "todas";
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (next: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
  onOpen: (t: Task) => void;
}) {
  const api = useColumnWidths("tarefas.lista", ALL_SPECS);
  const shown = ORDER.filter((c) => columns.includes(c));
  // 16px de respiro em cada ponta + a caixa de seleção; o resto vem das
  // colunas, cada uma com os 16px de espaço que a antecede.
  const minWidth = tableMinWidth(
    [TAREFA, ...shown.map((c) => COLUMNS[c])],
    api.widths,
    32 + 18,
  );
  const grouped = groups.length > 1 || groups[0]?.key !== "todas";

  return (
    <ColumnsProvider value={api}>
      <TableFrame minWidth={minWidth}>
        <TableHead>
          <Checkbox
            label="Selecionar todas as tarefas"
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={onToggleAll}
          />
          <HeadCell spec={TAREFA}>
            <FieldLabel>Tarefa</FieldLabel>
            <ChevronDownIcon size={13} className="text-label" />
          </HeadCell>
          {shown.map((c) => (
            <HeadCell key={c} spec={COLUMNS[c]}>
              <FieldLabel>{COLUMNS[c].label}</FieldLabel>
            </HeadCell>
          ))}
        </TableHead>

        <TableBody>
          {groups.map((g) => (
            <section key={g.key}>
              {grouped && (
                <header className="flex items-center gap-2 border-b border-rule-soft bg-surface-2/40 px-4 py-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.6px] text-fg-3">
                    {g.label}
                  </h3>
                  <span className="rounded-pill bg-border px-2 py-0.5 text-[11px] font-semibold text-fg-soft">
                    {g.tasks.length}
                  </span>
                </header>
              )}

              {g.tasks.length === 0 ? (
                <p className="border-b border-rule-soft px-4 py-3 text-[13px] text-muted">
                  Nenhuma tarefa neste grupo.
                </p>
              ) : subgroupKey === "nenhum" ? (
                <Rows
                  tasks={g.tasks}
                  perGroup={perGroup}
                  columns={shown}
                  selected={selected}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ) : (
                groupTasks(g.tasks, subgroupKey).map((sg) => (
                  <div key={sg.key}>
                    <p className="px-4 py-1.5 pl-6 text-[11px] font-medium uppercase tracking-[0.6px] text-muted">
                      {sg.label} · {sg.tasks.length}
                    </p>
                    <Rows
                      tasks={sg.tasks}
                      perGroup={perGroup}
                      columns={shown}
                      selected={selected}
                      onToggle={onToggle}
                      onOpen={onOpen}
                    />
                  </div>
                ))
              )}
            </section>
          ))}
        </TableBody>
      </TableFrame>
    </ColumnsProvider>
  );
}

function Rows({
  tasks,
  perGroup,
  columns,
  selected,
  onToggle,
  onOpen,
}: {
  tasks: Task[];
  perGroup: number | "todas";
  columns: VisibleColumnKey[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onOpen: (t: Task) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = perGroup === "todas" || expanded ? tasks.length : perGroup;
  const visible = tasks.slice(0, limit);
  const hidden = tasks.length - visible.length;

  return (
    <>
      {visible.map((t, i) => (
        <TableRow
          key={t.id}
          index={i}
          selected={selected.has(t.id)}
          onClick={() => onOpen(t)}
        >
          <Checkbox
            label={`Selecionar ${t.title}`}
            checked={selected.has(t.id)}
            onChange={() => onToggle(t.id)}
          />

          <ColumnCell spec={TAREFA} className="gap-2.5">
            <EntityMark name={t.title} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium text-fg">
                {t.title}
              </span>
              <span className="truncate text-[11px] text-sub">
                {t.client || "Sem cliente"}
              </span>
            </div>
          </ColumnCell>

          {columns.map((c) => (
            <ColumnCell key={c} spec={COLUMNS[c]}>
              <Cell column={c} task={t} />
            </ColumnCell>
          ))}
        </TableRow>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full border-b border-rule-soft px-4 py-2.5 text-left text-[12px] text-muted transition-colors hover:text-fg-soft"
        >
          Ver mais {hidden} {hidden === 1 ? "tarefa" : "tarefas"}
        </button>
      )}
    </>
  );
}

function Cell({ column, task }: { column: VisibleColumnKey; task: Task }) {
  switch (column) {
    case "status": {
      const meta = STATUS_BY_ID[task.status];
      return <Badge label={meta.label} fg={meta.badgeFg} size="md" />;
    }
    case "assignee":
      return <PersonChip name={task.assignee} />;
    case "dueDate":
      return (
        <span
          className={cn(
            "block truncate text-[13px]",
            isOverdue(task) ? "font-semibold text-fg" : "text-muted",
          )}
          title={isOverdue(task) ? "Prazo vencido" : undefined}
        >
          {task.dueDate ? formatShortDate(task.dueDate) : "—"}
        </span>
      );
    case "priority":
      return isRealPriority(task.priority) ? (
        <span className="flex items-center gap-2">
          <PriorityBars bars={PRIORITY_BY_ID[task.priority].bars} />
          <span className="truncate text-[13px] text-fg-3">
            {PRIORITY_BY_ID[task.priority].label}
          </span>
        </span>
      ) : (
        <span className="text-[13px] text-muted">—</span>
      );
    case "labels":
      return task.labels.length === 0 ? (
        <span className="text-[13px] text-muted">—</span>
      ) : (
        <span className="flex items-center gap-1.5 overflow-hidden">
          {task.labels.slice(0, 1).map((l) => (
            <Chip key={l} label={l} />
          ))}
          {task.labels.length > 1 && (
            <span className="text-[11px] text-muted">
              +{task.labels.length - 1}
            </span>
          )}
        </span>
      );
    case "createdAt":
      return (
        <span className="block truncate text-[13px] text-muted">
          {formatShortDate(task.createdAt)}
        </span>
      );
    case "id":
      return (
        <span className="block truncate text-[13px] text-muted">{task.id}</span>
      );
    default:
      return null;
  }
}

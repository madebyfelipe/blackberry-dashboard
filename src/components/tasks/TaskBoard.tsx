"use client";

import { useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES, STATUS_BY_ID } from "@/lib/tasks/constants";
import { formatShortDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { CardRow, EntityCard } from "@/components/ui/EntityCard";
import { PersonChip } from "@/components/ui/Mark";
import { ActionMenu } from "./ActionMenu";
import { PlusIcon, TrashIcon, ExternalLinkIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/*
 * Tarefas · Quadro, no design system v3 (export "Tarefas · Painel (Kanban)").
 *
 * O card é o mesmo objeto da grade de Clientes (`ui/EntityCard`): marca de
 * 36px, título e cliente, selo de status no canto, régua, a linha PRAZO,
 * régua e o rodapé com responsável e "⋯". Colunas de largura igual, título de
 * 15px e o contador em pílula clara.
 *
 * O arrastar-e-soltar e o "Adicionar tarefa" que só aparece no hover da
 * coluna são comportamento do produto e continuam como estavam — o desenho
 * mostra a coluna sob o ponteiro, que é exatamente esse estado.
 */
export function TaskBoard({
  tasks,
  onOpen,
  onStatusChange,
  onDelete,
  onAdd,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
  onAdd: (s: TaskStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  function handleDrop(status: TaskStatus) {
    const id = draggingId;
    setOverCol(null);
    setDraggingId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== status) onStatusChange(task, status);
  }

  return (
    <div className="flex h-full min-h-0 gap-4 overflow-x-auto overflow-y-auto pb-1">
      {STATUSES.map((col, colIndex) => {
        const items = tasks.filter((t) => t.status === col.id);
        const isOver = overCol === col.id;
        return (
          <div
            key={col.id}
            style={{ ["--d" as string]: colIndex }}
            className="group/column stagger-item flex min-w-[280px] flex-1 flex-col gap-3"
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== col.id) setOverCol(col.id);
            }}
            onDragLeave={(e) => {
              // Só limpa ao sair da coluna inteira.
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setOverCol((c) => (c === col.id ? null : c));
            }}
            onDrop={() => handleDrop(col.id)}
          >
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-fg-soft">
                {col.label}
              </span>
              <span
                // `key` no contador: cada mudança remonta o chip e ele entra
                // com a mola — é como a coluna avisa que ganhou/perdeu card.
                key={items.length}
                className="flex animate-scale-in items-center rounded-pill bg-border-strong px-[9px] py-[3px] text-[12px] font-medium text-fg"
              >
                {items.length}
              </span>
            </div>

            <div
              className={cn(
                "flex min-h-[80px] flex-1 flex-col gap-3 rounded-tile transition-all duration-200",
                isOver
                  ? "animate-drop-pulse bg-surface-2/40 outline outline-1 outline-dashed outline-border-strong"
                  : "",
              )}
            >
              {items.map((t, i) => (
                <EntityCard
                  key={t.id}
                  index={i}
                  name={t.title}
                  sub={t.client || "Sem cliente"}
                  draggable
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onOpen(t)}
                  className={cn(
                    "active:cursor-grabbing",
                    draggingId === t.id
                      ? "rotate-[1.2deg] scale-[0.98] opacity-40"
                      : "rotate-0 scale-100 opacity-100",
                  )}
                  badge={
                    <Badge
                      label={STATUS_BY_ID[t.status].label}
                      fg={STATUS_BY_ID[t.status].badgeFg}
                    />
                  }
                  footer={
                    <>
                      <PersonChip name={t.assignee} size={24} />
                      <div
                        className="flex h-6 w-7 shrink-0 items-center justify-center opacity-60 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    </>
                  }
                >
                  <CardRow label="Prazo">
                    {t.dueDate ? formatShortDate(t.dueDate) : "—"}
                  </CardRow>
                </EntityCard>
              ))}

              {/*
               * "Adicionar tarefa" pertence à coluna, não à tela: só aparece
               * quando o ponteiro está sobre a coluna (ou quando o próprio
               * botão recebe foco pelo teclado). Ele continua ocupando o
               * espaço mesmo invisível — sem isso a coluna vazia encolheria e
               * o alvo do hover sumiria junto.
               */}
              <button
                type="button"
                onClick={() => onAdd(col.id)}
                tabIndex={0}
                className={cn(
                  "tap flex translate-y-1 items-center justify-center gap-2 rounded-tile border border-border px-4 py-3 text-[13px] text-muted opacity-0",
                  "transition-[opacity,transform,color,border-color] duration-200",
                  "group-hover/column:translate-y-0 group-hover/column:opacity-100",
                  "focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
                  "hover:border-border-strong hover:text-fg-soft",
                )}
              >
                <PlusIcon size={16} />
                Adicionar tarefa
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

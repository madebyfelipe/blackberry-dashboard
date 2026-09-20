"use client";

import { useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES, STATUS_BY_ID } from "@/lib/tasks/constants";
import { PRIORITY_BY_ID, isRealPriority } from "@/lib/tasks/priority";
import { formatShortDate } from "@/lib/format";
import { ActionMenu } from "./ActionMenu";
import { PlusIcon, TrashIcon, ExternalLinkIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

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
            className="group/column stagger-item flex min-w-[260px] flex-1 flex-col gap-3"
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== col.id) setOverCol(col.id);
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the column entirely.
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
                className="flex animate-scale-in items-center rounded-pill bg-border-strong px-2.5 py-[3px] text-[12px] font-medium text-fg"
              >
                {items.length}
              </span>
            </div>

            <div
              className={cn(
                "flex min-h-[80px] flex-1 flex-col gap-3 rounded-card transition-all duration-200",
                isOver
                  ? "animate-drop-pulse bg-surface/40 outline outline-1 outline-dashed outline-border-strong"
                  : "",
              )}
            >
              {items.map((t, i) => (
                <div
                  key={t.id}
                  draggable
                  style={{ ["--d" as string]: i }}
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onOpen(t)}
                  className={cn(
                    "stagger-item group flex cursor-pointer flex-col gap-2.5 rounded-card border border-border bg-transparent p-5",
                    "transition-[transform,border-color,background-color,opacity] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/60 active:cursor-grabbing",
                    draggingId === t.id
                      ? "rotate-[1.2deg] scale-[0.98] opacity-40"
                      : "rotate-0 scale-100 opacity-100",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-muted">
                      {t.client || "—"}
                    </span>
                    {isRealPriority(t.priority) && (
                      <span className="shrink-0 rounded-pill border border-border px-2 py-[2px] text-[10px] font-medium text-fg-3">
                        {PRIORITY_BY_ID[t.priority].label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-110"
                        style={{
                          outline: `1.6px solid ${STATUS_BY_ID[t.status].dot}`,
                          outlineOffset: "-0.8px",
                        }}
                      />
                      <span className="truncate text-[14px] font-semibold text-fg">
                        {t.title}
                      </span>
                    </div>
                    <div className="flex h-6 w-7 shrink-0 items-center justify-center opacity-60 transition-opacity group-hover:opacity-100">
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">
                      Criado {formatShortDate(t.createdAt)}
                    </span>
                    {t.labels.length > 0 && (
                      <span className="truncate text-[11px] text-dim">
                        {t.labels.map((l) => "#" + l).join(" ")}
                      </span>
                    )}
                  </div>
                </div>
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
                  "tap flex translate-y-1 items-center justify-center gap-2 rounded-card border border-border px-4 py-3 text-[13px] text-muted opacity-0",
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

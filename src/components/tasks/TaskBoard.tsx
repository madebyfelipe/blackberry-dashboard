"use client";

import { useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES, STATUS_BY_ID } from "@/lib/tasks/constants";
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
    <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-1">
      {STATUSES.map((col) => {
        const items = tasks.filter((t) => t.status === col.id);
        const isOver = overCol === col.id;
        return (
          <div
            key={col.id}
            className="group/column flex w-[300px] shrink-0 flex-col gap-3"
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
            <div className="flex items-center gap-2 px-1">
              <span className="text-[15px] font-semibold text-fg-soft">
                {col.label}
              </span>
              <span className="flex items-center rounded-pill bg-border-strong px-2.5 py-[3px] text-[12px] font-medium text-fg">
                {items.length}
              </span>
            </div>

            <div
              className={cn(
                "flex min-h-[80px] flex-1 flex-col gap-2 rounded-[20px] p-1 transition-colors",
                isOver ? "bg-[#050407] outline outline-1 outline-dashed outline-border-strong" : "",
              )}
            >
              {items.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDraggingId(t.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onOpen(t)}
                  className={cn(
                    "group flex cursor-pointer flex-col gap-2.5 rounded-card border border-border bg-surface-2 p-5 transition-all hover:border-border-strong active:cursor-grabbing",
                    draggingId === t.id ? "opacity-40" : "opacity-100",
                  )}
                >
                  <div className="text-[12px] text-muted">{t.client || "—"}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{
                          outline: `1.6px solid ${STATUS_BY_ID[t.status].dot}`,
                          outlineOffset: "-0.8px",
                        }}
                      />
                      <span className="truncate text-[14px] font-semibold text-fg">
                        {t.title}
                      </span>
                    </div>
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
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
                  <div className="text-[11px] text-muted">
                    Criado {formatShortDate(t.createdAt)}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => onAdd(col.id)}
                className="flex items-center justify-center gap-2 rounded-card border border-border px-4 py-3 text-[13px] text-muted opacity-0 transition-all hover:border-border-strong hover:text-fg-soft focus-visible:opacity-100 group-hover/column:opacity-100"
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

"use client";

import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUS_BY_ID } from "@/lib/tasks/constants";
import { formatShortDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { StatusMenu } from "./StatusMenu";
import { ActionMenu } from "./ActionMenu";
import { TrashIcon, ExternalLinkIcon } from "@/components/icons";

export function TaskTable({
  tasks,
  onOpen,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[];
  onOpen: (t: Task) => void;
  onStatusChange: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-3">
        <div className="flex-1 text-[12px] font-semibold tracking-[0.3px] text-muted">
          TAREFA
        </div>
        <div className="w-[150px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
          STATUS
        </div>
        <div className="w-[130px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
          RESPONSÁVEL
        </div>
        <div className="w-[90px] shrink-0 text-[12px] font-semibold tracking-[0.3px] text-muted">
          CRIADO
        </div>
        <div className="w-8 shrink-0" />
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tasks.map((t) => (
          <div
            key={t.id}
            onClick={() => onOpen(t)}
            className="group flex cursor-pointer items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface"
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
                <span className="truncate text-[12px] text-muted">
                  {t.client || "—"}
                </span>
              </div>
            </div>
            <div className="w-[150px] shrink-0">
              <StatusMenu
                status={t.status}
                onSelect={(s) => onStatusChange(t, s)}
              />
            </div>
            <div className="w-[130px] shrink-0">
              <Avatar initial={t.assignee} />
            </div>
            <div className="w-[90px] shrink-0 text-[13px] text-muted">
              {formatShortDate(t.createdAt)}
            </div>
            <div className="flex w-8 shrink-0 justify-center opacity-0 transition-opacity group-hover:opacity-100">
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
      </div>
    </div>
  );
}

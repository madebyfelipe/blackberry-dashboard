"use client";

import { useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES } from "@/lib/tasks/constants";
import { formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusDot } from "@/components/ui/StatusPill";
import { XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type DrawerState =
  | { mode: "create"; status?: TaskStatus }
  | { mode: "edit"; task: Task };

export function TaskDrawer({
  state,
  onClose,
  onSubmit,
  saving,
}: {
  state: DrawerState | null;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    client: string;
    assignee: string;
    status: TaskStatus;
  }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TaskStatus>("a-fazer");

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setTitle(state.task.title);
      setClient(state.task.client);
      setAssignee(state.task.assignee === "—" ? "" : state.task.assignee);
      setStatus(state.task.status);
    } else {
      setTitle("");
      setClient("");
      setAssignee("");
      setStatus(state.status ?? "a-fazer");
    }
  }, [state]);

  // Close on Escape.
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;
  const isEdit = state.mode === "edit";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, client, assignee, status });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[420px] animate-drawer-in flex-col border-l border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-[15px] font-semibold text-fg">
            {isEdit ? "Editar tarefa" : "Nova tarefa"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-border hover:text-fg-soft"
          >
            <XIcon size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <Field label="Título">
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Quinzenal 2 - Montê"
              />
            </Field>
            <Field label="Cliente">
              <Input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ex.: Montê bar"
              />
            </Field>
            <Field label="Responsável (inicial)">
              <Input
                value={assignee}
                maxLength={2}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Ex.: F"
              />
            </Field>
            <Field label="Status">
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-pill px-3 py-1.5 text-[13px] transition-colors",
                      status === s.id
                        ? "bg-primary text-on-primary"
                        : "text-fg-soft outline outline-1 -outline-offset-[0.5px] outline-border hover:bg-border",
                    )}
                  >
                    <StatusDot status={s.id} size={8} />
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            {isEdit && (
              <p className="pt-1 text-[12px] text-muted">
                Criado em {formatShortDate(state.task.createdAt)}
              </p>
            )}
          </div>

          <footer className="flex gap-3 border-t border-border px-6 py-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "Salvando…" : isEdit ? "Salvar" : "Criar tarefa"}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-fg-3">{label}</span>
      {children}
    </label>
  );
}

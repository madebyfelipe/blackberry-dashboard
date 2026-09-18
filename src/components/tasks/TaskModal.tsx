"use client";

import { useEffect, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { useToast } from "@/components/ui/Toast";
import { StatusMenu } from "./StatusMenu";
import {
  BoxIcon,
  ChevronRightIcon,
  EllipsisIcon,
  Maximize2Icon,
  PaperclipIcon,
  SignalIcon,
  TagIcon,
  UserCircleIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

export type TaskModalState =
  | { mode: "create"; status?: TaskStatus }
  | { mode: "edit"; task: Task };

/** Quick-create/edit modal, faithful to the "New Issue Modal" export. */
export function TaskModal({
  state,
  onClose,
  onSubmit,
  saving,
}: {
  state: TaskModalState | null;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    client: string;
    assignee: string;
    status: TaskStatus;
  }) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      setDescription("");
    } else {
      setTitle("");
      setClient("");
      setAssignee("");
      setStatus(state.status ?? "a-fazer");
      setDescription("");
    }
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;
  const isEdit = state.mode === "edit";
  const soon = () => toast("Em breve.", "info");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, client, assignee, status });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/80" onClick={onClose} />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-[660px] animate-pop-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-mark bg-[#616161] text-[11px] font-bold text-fg">
              b
            </span>
            <span className="text-[14px] text-[#616167]">black berry</span>
            <ChevronRightIcon size={16} className="text-[#616167]" />
            <span className="text-[14px] font-semibold text-fg-soft">
              {isEdit ? "Editar tarefa" : "Nova tarefa"}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <IconGhost label="Expandir" onClick={soon}>
              <Maximize2Icon size={16} />
            </IconGhost>
            <IconGhost label="Fechar" onClick={onClose}>
              <XIcon size={16} />
            </IconGhost>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa"
            className="w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-[#55556A] focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicionar descrição..."
            rows={2}
            className="w-full resize-none bg-transparent text-[14px] text-fg-soft placeholder:text-[#55556A] focus:outline-none"
          />
        </div>

        {/* Field toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          <StatusMenu status={status} onSelect={setStatus} />

          <Chip icon={<SignalIcon size={14} />} label="Prioridade" onClick={soon} />

          <ChipField
            icon={<UserCircleIcon size={14} />}
            placeholder="Responsável"
            value={assignee}
            maxLength={2}
            onChange={setAssignee}
          />

          <ChipField
            icon={<BoxIcon size={14} />}
            placeholder="Projeto"
            value={client}
            onChange={setClient}
          />

          <Chip icon={<TagIcon size={14} />} label="Etiquetas" onClick={soon} />

          <IconGhost label="Mais opções" onClick={soon}>
            <EllipsisIcon size={16} />
          </IconGhost>
        </div>

        <div className="h-px w-full bg-border" />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <IconGhost label="Anexar" onClick={soon}>
            <PaperclipIcon size={16} />
          </IconGhost>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvando…" : isEdit ? "Salvar" : "Criar Tarefa"}
          </button>
        </div>
      </form>
    </div>
  );
}

function IconGhost({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex items-center justify-center rounded-full p-2.5 text-muted transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}

function Chip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] text-fg-3 outline outline-1 -outline-offset-[0.5px] outline-border transition-colors hover:bg-border"
    >
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  );
}

/** Chip that turns into a tiny inline text input when clicked. */
function ChipField({
  icon,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    onChange(draft.trim());
    setOpen(false);
  }

  if (open) {
    return (
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 outline outline-1 -outline-offset-[0.5px] outline-border-strong">
        <span className="text-muted">{icon}</span>
        <input
          autoFocus
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(value);
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-24 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] outline outline-1 -outline-offset-[0.5px] outline-border transition-colors hover:bg-border",
        value ? "text-fg-soft" : "text-fg-3",
      )}
    >
      <span className="text-muted">{icon}</span>
      {value || placeholder}
    </button>
  );
}

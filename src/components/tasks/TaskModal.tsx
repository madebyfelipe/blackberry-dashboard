"use client";

import { useEffect, useRef, useState } from "react";
import type { Task, TaskPriority, TaskStatus } from "@/lib/tasks/types";
import { PRIORITIES, PRIORITY_BY_ID, isRealPriority } from "@/lib/tasks/priority";
import { toDatetimeLocal } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { StatusMenu } from "./StatusMenu";
import {
  BoxIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  Maximize2Icon,
  PaperclipIcon,
  SignalIcon,
  TagIcon,
  UserCircleIcon,
  XIcon,
} from "@/components/icons";
import { PriorityBars } from "./PriorityBars";
import { cn } from "@/lib/cn";

export type TaskModalValues = {
  title: string;
  client: string;
  assignee: string;
  status: TaskStatus;
  description: string;
  priority: TaskPriority;
  labels: string[];
  dueDate: string | null;
};

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
  onSubmit: (values: TaskModalValues) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [client, setClient] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TaskStatus>("a-fazer");
  const [priority, setPriority] = useState<TaskPriority>("sem");
  const [labels, setLabels] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const t = state.task;
      setTitle(t.title);
      setClient(t.client);
      setAssignee(t.assignee === "—" ? "" : t.assignee);
      setStatus(t.status);
      setDescription(t.description);
      setPriority(t.priority);
      setLabels(t.labels);
      setDueDate(t.dueDate);
    } else {
      setTitle("");
      setClient("");
      setAssignee("");
      setStatus(state.status ?? "a-fazer");
      setDescription("");
      setPriority("sem");
      setLabels([]);
      setDueDate(null);
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
    onSubmit({
      title,
      client,
      assignee,
      status,
      description,
      priority,
      labels,
      dueDate,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-black/80 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full max-w-[660px] animate-scale-in flex-col overflow-hidden rounded-card border border-border bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-mark bg-dim text-[11px] font-bold text-fg">
              b
            </span>
            <span className="text-[14px] text-dim">black berry</span>
            <ChevronRightIcon size={16} className="text-dim" />
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
            className="w-full bg-transparent text-[20px] font-semibold text-fg placeholder:text-muted focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicionar descrição..."
            rows={2}
            className="w-full resize-none bg-transparent text-[14px] text-fg-soft placeholder:text-muted focus:outline-none"
          />
        </div>

        {/* Field toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
          <StatusMenu status={status} onSelect={setStatus} />

          <PriorityChip priority={priority} onSelect={setPriority} />

          <ChipField
            icon={<UserCircleIcon size={14} />}
            placeholder="Responsável"
            value={assignee}
            onChange={setAssignee}
          />

          <ChipField
            icon={<BoxIcon size={14} />}
            placeholder="Projeto"
            value={client}
            onChange={setClient}
          />

          <LabelsChip labels={labels} onChange={setLabels} />

          <DueChip value={dueDate} onChange={setDueDate} />

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
            className="tap rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Salvando…
              </span>
            ) : isEdit ? (
              "Salvar"
            ) : (
              "Criar Tarefa"
            )}
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
      className="tap flex items-center justify-center rounded-full p-2.5 text-muted transition-colors hover:bg-border hover:text-fg-soft"
    >
      {children}
    </button>
  );
}

const chipBase =
  "tap flex items-center gap-1.5 rounded-pill px-4 py-2 text-[13px] inset-ring-1 transition-colors";

/** Chip com menu de prioridade (a régua vive em `lib/tasks/priority.ts`). */
function PriorityChip({
  priority,
  onSelect,
}: {
  priority: TaskPriority;
  onSelect: (p: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = isRealPriority(priority);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          chipBase,
          active
            ? "text-fg-soft inset-ring-border-strong"
            : "text-fg-3 inset-ring-border hover:bg-border",
        )}
      >
        <span className="text-muted">
          <SignalIcon size={14} />
        </span>
        {active ? PRIORITY_BY_ID[priority].label : "Prioridade"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[190px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
        >
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(p.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-mark px-2.5 py-1.5 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
            >
              <span className="flex items-center gap-2.5">
                <PriorityBars bars={p.bars} />
                {p.label}
              </span>
              <CheckIcon
                size={14}
                className={cn(priority === p.id ? "opacity-100" : "opacity-0")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Etiquetas livres: digita, Enter adiciona; Backspace no vazio remove a última. */
function LabelsChip({
  labels,
  onChange,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim().replace(/^#/, "");
    if (value && !labels.includes(value)) onChange([...labels, value].slice(0, 8));
    setDraft("");
  }

  if (open) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">
          <TagIcon size={14} />
        </span>
        {labels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(labels.filter((x) => x !== l))}
            title={`Remover #${l}`}
            className="animate-scale-in rounded-pill bg-border px-2 py-0.5 text-[11px] text-fg-soft transition-colors hover:bg-border-strong"
          >
            #{l} ×
          </button>
        ))}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            add();
            setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && labels.length) {
              onChange(labels.slice(0, -1));
            } else if (e.key === "Escape") {
              setDraft("");
              setOpen(false);
            }
          }}
          placeholder="etiqueta"
          className="w-20 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        chipBase,
        labels.length
          ? "text-fg-soft inset-ring-border-strong"
          : "text-fg-3 inset-ring-border hover:bg-border",
      )}
    >
      <span className="text-muted">
        <TagIcon size={14} />
      </span>
      {labels.length ? labels.map((l) => "#" + l).join(" ") : "Etiquetas"}
    </button>
  );
}

/** Prazo interno — abre um datetime-local no lugar do chip. */
function DueChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
        <span className="text-muted">
          <CalendarIcon size={14} />
        </span>
        <input
          autoFocus
          type="datetime-local"
          value={value ? toDatetimeLocal(value) : ""}
          onChange={(e) =>
            onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
          }
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className="bg-transparent text-[13px] text-fg-soft focus:outline-none [color-scheme:dark]"
        />
        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
            aria-label="Limpar prazo"
            className="text-muted transition-colors hover:text-fg-soft"
          >
            <XIcon size={13} />
          </button>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        chipBase,
        value
          ? "text-fg-soft inset-ring-border-strong"
          : "text-fg-3 inset-ring-border hover:bg-border",
      )}
    >
      <span className="text-muted">
        <CalendarIcon size={14} />
      </span>
      {value
        ? new Date(value).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          })
        : "Prazo"}
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
      <span className="flex items-center gap-1.5 rounded-pill px-4 py-2 inset-ring-1 inset-ring-border-strong">
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
        chipBase,
        value ? "text-fg-soft inset-ring-border" : "text-fg-3 inset-ring-border",
        "hover:bg-border",
      )}
    >
      <span className="text-muted">{icon}</span>
      {value || placeholder}
    </button>
  );
}

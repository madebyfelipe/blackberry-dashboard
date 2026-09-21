"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task, TaskPatch, TaskPriority, TaskStatus } from "@/lib/tasks/types";
import { STATUSES, STATUS_BY_ID } from "@/lib/tasks/constants";
import { PRIORITIES, PRIORITY_BY_ID, isRealPriority } from "@/lib/tasks/priority";
import { formatRelative, formatShortDate, toDatetimeLocal } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Badge";
import { PersonAvatar } from "@/components/ui/Mark";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "./ActionMenu";
import { PriorityBars } from "./PriorityBars";
import {
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  CirclePlusIcon,
  FolderIcon,
  PaperclipIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { apiAddTaskComment, apiDeleteTask, apiUpdateTask } from "./api";
import { cn } from "@/lib/cn";

/*
 * Descrição da tarefa (export "desc_tarefa") — visualizador e editor ao mesmo
 * tempo: tudo que se lê aqui se altera aqui, sem abrir modal.
 *
 * Duas colunas. A da esquerda rola (descrição + atividade) e tem a caixa de
 * comentário presa embaixo; a da direita (340px, PROPRIEDADES) é um irmão com
 * rolagem própria, então ela **não acompanha** a rolagem do conteúdo — fica no
 * lugar, como o desenho pede. No celular as duas viram uma coluna só.
 *
 * Cada alteração é otimista e salva sozinha: o estado da tela muda na hora, o
 * PATCH vai atrás, e um erro devolve o valor anterior com um toast. Não há
 * botão "Salvar" porque não há rascunho — é edição direta.
 */
export function TaskDetail({ task: initial }: { task: Task }) {
  const router = useRouter();
  const { toast } = useToast();
  const [task, setTask] = useState<Task>(initial);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Voltar do cache do roteador com dados novos: a tela acompanha.
  useEffect(() => setTask(initial), [initial]);

  async function patch(values: TaskPatch) {
    const before = task;
    setTask((t) => ({ ...t, ...values }) as Task);
    try {
      const updated = await apiUpdateTask(task.id, values);
      setTask(updated);
      // A lista atrás desta tela precisa ver a mudança ao voltar.
      router.refresh();
    } catch (e) {
      setTask(before);
      toast(errMsg(e), "error");
    }
  }

  async function remove() {
    try {
      await apiDeleteTask(task.id);
      toast("Tarefa excluída.");
      router.push("/tarefas");
      router.refresh();
    } catch (e) {
      toast(errMsg(e), "error");
    }
  }

  async function comment(text: string) {
    try {
      const updated = await apiAddTaskComment(task.id, text);
      setTask(updated);
    } catch (e) {
      toast(errMsg(e), "error");
      throw e;
    }
  }

  const status = STATUS_BY_ID[task.status];

  return (
    <Screen>
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Tarefas", href: "/tarefas" },
          { label: task.title },
        ]}
      />

      {/* Cabeçalho — título, cliente e as duas ações redondas */}
      <div className="flex w-full shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: status.dot }}
              aria-hidden="true"
            />
            <AutoTextarea
              ref={titleRef}
              value={task.title}
              aria-label="Título da tarefa"
              onCommit={(v) => v !== task.title && patch({ title: v })}
              className="min-w-0 flex-1 text-[24px] font-semibold leading-tight text-fg"
            />
          </div>
          <InlineText
            value={task.client}
            placeholder="Sem cliente"
            aria-label="Cliente"
            onCommit={(v) => v !== task.client && patch({ client: v })}
            className="text-[13px] text-muted"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Renomear tarefa"
            title="Renomear tarefa"
            onClick={() => {
              titleRef.current?.focus();
              titleRef.current?.select();
            }}
            className="tap flex h-10 w-10 items-center justify-center rounded-full bg-surface text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-soft"
          >
            <PencilIcon size={17} />
          </button>
          <ActionMenu
            triggerClassName="bg-surface hover:bg-surface-2"
            items={[
              {
                label: "Excluir tarefa",
                icon: <TrashIcon size={15} />,
                danger: true,
                onSelect: remove,
              },
            ]}
          />
        </div>
      </div>

      {/* Corpo — duas colunas independentes */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-7 overflow-hidden md:flex-row">
        {/* Esquerda: descrição + atividade (rola) e o campo de comentário (preso) */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <section className="flex shrink-0 flex-col gap-3">
              <SectionLabel>Descrição</SectionLabel>
              <AutoTextarea
                value={task.description}
                placeholder="Adicionar descrição…"
                aria-label="Descrição da tarefa"
                onCommit={(v) =>
                  v !== task.description && patch({ description: v })
                }
                className="text-[14px] leading-[21px] text-fg-soft"
              />
            </section>

            <span className="h-px w-full shrink-0 bg-border" aria-hidden="true" />

            <section className="flex shrink-0 flex-col gap-2">
              <SectionLabel>Atividade</SectionLabel>
              <p className="flex items-center gap-2 text-[12px] text-muted">
                <CirclePlusIcon size={14} className="text-faint" />
                {task.creator === "—" ? "Tarefa criada" : `${task.creator} criou a tarefa`}{" "}
                · {formatRelative(task.createdAt)}
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                {task.comments.map((c) => (
                  <article key={c.id} className="flex w-full items-start gap-2.5">
                    <PersonAvatar name={c.author} size={26} />
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-fg-soft">
                          {c.author}
                        </span>
                        <span className="text-[11px] text-muted">
                          {formatRelative(c.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-[18px] text-fg">
                        {c.text}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <CommentBox onSubmit={comment} />
        </div>

        {/*
         * Direita: as propriedades. Rolagem própria — é o que mantém a coluna
         * parada enquanto o conteúdo da esquerda rola.
         */}
        <aside className="flex w-full shrink-0 flex-col gap-2.5 overflow-y-auto md:w-[340px]">
          <SectionLabel>Propriedades</SectionLabel>

          <PropertyRow label="Status">
            <StatusSelect
              status={task.status}
              onSelect={(s) => s !== task.status && patch({ status: s })}
            />
          </PropertyRow>

          <PropertyRow label="Responsável">
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={task.assignee} />
              <InlineText
                value={task.assignee === "—" ? "" : task.assignee}
                placeholder="Sem responsável"
                aria-label="Responsável"
                onCommit={(v) => v !== task.assignee && patch({ assignee: v })}
                className="text-[13px] text-fg-soft"
              />
            </span>
          </PropertyRow>

          {/* Criado por não se edita: ele vem da sessão de quem criou. */}
          <PropertyRow label="Criado por">
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar name={task.creator} />
              <span className="truncate text-[13px] text-fg-soft">
                {task.creator}
              </span>
            </span>
          </PropertyRow>

          <PropertyRow label="Projeto">
            <span className="flex min-w-0 items-center gap-2">
              <FolderIcon size={15} className="text-muted" />
              <InlineText
                value={task.client}
                placeholder="Sem projeto"
                aria-label="Projeto"
                onCommit={(v) => v !== task.client && patch({ client: v })}
                className="text-[13px] text-fg-soft"
              />
            </span>
          </PropertyRow>

          <PropertyRow label="Prioridade">
            <PrioritySelect
              priority={task.priority}
              onSelect={(p) => p !== task.priority && patch({ priority: p })}
            />
          </PropertyRow>

          {/*
           * O export termina a coluna numa régua, sem mostrar o que vem
           * depois. O prazo é campo que já existe (coluna PRAZO da lista e do
           * card do quadro) e sem ele a tela de edição não conseguiria
           * editá-lo — por isso ele entra aqui, na mesma forma das outras
           * linhas, até o desenho dizer o contrário.
           */}
          <PropertyRow label="Prazo">
            <DueSelect
              value={task.dueDate}
              onChange={(v) => patch({ dueDate: v })}
            />
          </PropertyRow>

          <PropertyRow label="Etiqueta" align="start">
            <LabelsEditor
              labels={task.labels}
              onChange={(labels) => patch({ labels })}
            />
          </PropertyRow>

          <span className="h-px w-full shrink-0 bg-border" aria-hidden="true" />
        </aside>
      </div>
    </Screen>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-semibold uppercase tracking-[0.3px] text-muted">
      {children}
    </span>
  );
}

function PropertyRow({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full gap-3",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <span
        className={cn(
          "w-[110px] shrink-0 text-[13px] text-muted",
          align === "start" && "pt-1",
        )}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- campos */

/**
 * Texto que se edita no lugar: parece rótulo, vira campo ao clicar. Salva no
 * blur e no Enter; Esc devolve o valor anterior.
 */
function InlineText({
  value,
  placeholder,
  onCommit,
  className,
  ...rest
}: {
  value: string;
  placeholder: string;
  onCommit: (v: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "min-w-0 flex-1 truncate rounded-mark bg-transparent px-1 py-0.5 -mx-1",
        "transition-colors placeholder:text-muted hover:bg-surface-2 focus:bg-surface-2 focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

/** Textarea que cresce com o texto — título e descrição são multilinha. */
function AutoTextarea({
  ref,
  value,
  placeholder,
  onCommit,
  className,
  ...rest
}: {
  ref?: React.Ref<HTMLTextAreaElement>;
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  className?: string;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "ref"
>) {
  const [draft, setDraft] = useState(value);
  const inner = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value), [value]);

  // Altura acompanha o conteúdo: zera e volta ao scrollHeight a cada mudança.
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  return (
    <textarea
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
      }}
      rows={1}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "w-full resize-none overflow-hidden rounded-mark bg-transparent px-1 py-0.5 -mx-1",
        "transition-colors placeholder:text-muted hover:bg-surface-2 focus:bg-surface-2 focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
}

/** A pílula de status do export, com o menu do pipeline atrás. */
function StatusSelect({
  status,
  onSelect,
}: {
  status: TaskStatus;
  onSelect: (s: TaskStatus) => void;
}) {
  const meta = STATUS_BY_ID[status];
  return (
    <Dropdown
      label="Mudar status"
      trigger={
        <span className="flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 inset-ring-1 inset-ring-border">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: meta.dot }}
          />
          <span className="whitespace-nowrap text-[12px] text-fg-soft">
            {meta.label}
          </span>
        </span>
      }
      options={STATUSES.map((s) => ({
        id: s.id,
        label: s.label,
        icon: (
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ backgroundColor: s.dot }}
          />
        ),
      }))}
      value={status}
      onSelect={(id) => onSelect(id as TaskStatus)}
    />
  );
}

function PrioritySelect({
  priority,
  onSelect,
}: {
  priority: TaskPriority;
  onSelect: (p: TaskPriority) => void;
}) {
  return (
    <Dropdown
      label="Mudar prioridade"
      trigger={
        <span className="flex items-center gap-2 rounded-mark px-1 py-0.5 -mx-1 transition-colors hover:bg-surface-2">
          <PriorityBars bars={PRIORITY_BY_ID[priority].bars} />
          <span
            className={cn(
              "whitespace-nowrap text-[13px]",
              isRealPriority(priority) ? "text-fg-soft" : "text-muted",
            )}
          >
            {isRealPriority(priority)
              ? PRIORITY_BY_ID[priority].label
              : "Sem prioridade"}
          </span>
        </span>
      }
      options={PRIORITIES.map((p) => ({
        id: p.id,
        label: p.label,
        icon: <PriorityBars bars={p.bars} />,
      }))}
      value={priority}
      onSelect={(id) => onSelect(id as TaskPriority)}
    />
  );
}

/** Menu genérico das propriedades: gatilho livre, lista com marca de escolha. */
function Dropdown({
  label,
  trigger,
  options,
  value,
  onSelect,
}: {
  label: string;
  trigger: React.ReactNode;
  options: { id: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="tap flex min-w-0 items-center text-left"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-[200px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === value}
              onClick={() => {
                setOpen(false);
                onSelect(o.id);
              }}
              className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-border"
            >
              {o.icon}
              <span className="flex-1 truncate">{o.label}</span>
              {o.id === value && <CheckIcon size={14} className="text-muted" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DueSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <span className="flex items-center gap-2">
        <CalendarIcon size={15} className="text-muted" />
        <input
          autoFocus
          type="datetime-local"
          value={value ? toDatetimeLocal(value) : ""}
          onChange={(e) =>
            onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
          }
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="bg-transparent text-[13px] text-fg-soft focus:outline-none [color-scheme:dark]"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpar prazo"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(null)}
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
      onClick={() => setEditing(true)}
      className="tap flex items-center gap-2 rounded-mark px-1 py-0.5 -mx-1 transition-colors hover:bg-surface-2"
    >
      <CalendarIcon size={15} className="text-muted" />
      <span
        className={cn("text-[13px]", value ? "text-fg-soft" : "text-muted")}
      >
        {value ? formatShortDate(value) : "Sem prazo"}
      </span>
    </button>
  );
}

/** Etiquetas: os selos do export + um campo que some quando não está em uso. */
function LabelsEditor({
  labels,
  onChange,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  function add() {
    const value = draft.trim().replace(/^#/, "");
    if (value && !labels.includes(value)) onChange([...labels, value].slice(0, 8));
    setDraft("");
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <button
          key={l}
          type="button"
          title={`Remover ${l}`}
          onClick={() => onChange(labels.filter((x) => x !== l))}
          className="tap rounded-mark transition-opacity hover:opacity-70"
        >
          <Chip label={l} />
        </button>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            add();
            setAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="etiqueta"
          className="w-24 rounded-mark bg-surface-2 px-2 py-1 text-[11px] text-fg-soft placeholder:text-muted focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap rounded-mark px-[9px] py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg-soft"
        >
          {labels.length ? "+ etiqueta" : "Sem etiqueta"}
        </button>
      )}
    </span>
  );
}

/** A caixa de comentário presa no pé da coluna da esquerda. */
function CommentBox({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSubmit(value);
      setText("");
    } catch {
      // O erro já virou toast em quem chamou; o texto fica para tentar de novo.
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      className="flex w-full shrink-0 items-center gap-2 rounded-field bg-surface-2 px-2.5 py-2 inset-ring-1 inset-ring-border"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Deixe um comentário..."
        aria-label="Novo comentário"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-soft placeholder:text-muted focus:outline-none"
      />
      <button
        type="button"
        aria-label="Anexar"
        title="Anexar"
        onClick={() => toast("Anexo no comentário chega com o upload da tarefa.", "info")}
        className="tap shrink-0 text-muted transition-colors hover:text-fg-soft"
      >
        <PaperclipIcon size={15} />
      </button>
      <button
        type="submit"
        aria-label="Enviar comentário"
        disabled={!text.trim() || sending}
        className="tap flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUpIcon size={14} strokeWidth={2.5} />
      </button>
    </form>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado.";
}

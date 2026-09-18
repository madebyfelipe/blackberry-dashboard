"use client";

import { useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES } from "@/lib/tasks/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import {
  PlusIcon,
  SlidersIcon,
  Settings2Icon,
  SearchIcon,
  SquareCheckIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { TaskTable } from "./TaskTable";
import { TaskBoard } from "./TaskBoard";
import { TaskModal, type TaskModalState } from "./TaskModal";
import {
  apiCreateTask,
  apiDeleteTask,
  apiUpdateTask,
} from "./api";

type View = "lista" | "board";
type Tab = TaskStatus | "todas";

export function TasksView({ initialTasks }: { initialTasks: Task[] }) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<View>("lista");
  const [tab, setTab] = useState<Tab>("todas");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [drawer, setDrawer] = useState<TaskModalState | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (view === "lista" && tab !== "todas" && t.status !== tab) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.client.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    });
  }, [tasks, tab, search, view]);

  const counts = useMemo(() => {
    const m = new Map<Tab, number>();
    m.set("todas", tasks.length);
    for (const s of STATUSES) m.set(s.id, 0);
    for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [tasks]);

  // ---- mutations (optimistic) ----

  async function changeStatus(task: Task, status: TaskStatus) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await apiUpdateTask(task.id, { status });
    } catch (e) {
      setTasks(prev);
      toast(errMsg(e), "error");
    }
  }

  // Delayed delete: remove from UI immediately, offer undo, and only hit the
  // API if the toast expires without an undo.
  function remove(task: Task) {
    const index = tasks.findIndex((t) => t.id === task.id);
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await apiDeleteTask(task.id);
      } catch (e) {
        setTasks((ts) =>
          ts.some((t) => t.id === task.id)
            ? ts
            : insertAt(ts, index, task),
        );
        toast(errMsg(e), "error");
      }
    }, 4200);

    toast("Tarefa excluída.", "success", {
      duration: 4000,
      action: {
        label: "Desfazer",
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setTasks((ts) =>
            ts.some((t) => t.id === task.id) ? ts : insertAt(ts, index, task),
          );
        },
      },
    });
  }

  async function submitDrawer(values: {
    title: string;
    client: string;
    assignee: string;
    status: TaskStatus;
  }) {
    if (!drawer) return;
    setSaving(true);
    try {
      if (drawer.mode === "create") {
        const created = await apiCreateTask(values);
        setTasks((ts) => [created, ...ts]);
        toast("Tarefa criada.");
      } else {
        const updated = await apiUpdateTask(drawer.task.id, values);
        setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
        toast("Alterações salvas.");
      }
      setDrawer(null);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 py-6 pl-2 pr-6">
      <Breadcrumb
        items={[{ label: "black berry", href: "/tarefas" }, { label: "Tarefas" }]}
      />

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: tabs (list) or title (board) */}
        {view === "lista" ? (
          <div className="flex items-center gap-2 overflow-x-auto">
            <Tab
              active={tab === "todas"}
              onClick={() => setTab("todas")}
              label="Todas"
              count={counts.get("todas") ?? 0}
            />
            {STATUSES.map((s) => (
              <Tab
                key={s.id}
                active={tab === s.id}
                onClick={() => setTab(s.id)}
                label={s.label}
                count={counts.get(s.id) ?? 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[15px] font-semibold text-fg-soft">
            <SquareCheckIcon size={18} className="text-muted" />
            Board · {tasks.length} tarefas
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => !search && setShowSearch(false)}
              placeholder="Buscar tarefa, cliente…"
              className="w-[220px] animate-fade-in rounded-pill border border-border bg-surface px-4 py-2 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
            />
          )}

          {/* View toggle */}
          <div className="flex items-center rounded-pill bg-surface p-1">
            <Seg active={view === "lista"} onClick={() => setView("lista")}>
              Lista
            </Seg>
            <Seg active={view === "board"} onClick={() => setView("board")}>
              Board
            </Seg>
          </div>

          <IconBtn
            label="Buscar"
            onClick={() => setShowSearch((s) => !s)}
            active={showSearch}
          >
            <SearchIcon size={16} />
          </IconBtn>
          <IconBtn label="Filtros" onClick={() => toast("Filtros avançados em breve.", "info")}>
            <SlidersIcon size={16} />
          </IconBtn>
          <IconBtn label="Colunas" onClick={() => toast("Configuração de colunas em breve.", "info")}>
            <Settings2Icon size={16} />
          </IconBtn>

          <Button
            className="w-fit"
            onClick={() => setDrawer({ mode: "create" })}
          >
            <span className="flex items-center gap-1.5">
              <PlusIcon size={16} /> Adicionar tarefa
            </span>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <EmptyState onAdd={() => setDrawer({ mode: "create" })} />
        ) : view === "lista" ? (
          <TaskTable
            tasks={filtered}
            onOpen={(t) => setDrawer({ mode: "edit", task: t })}
            onStatusChange={changeStatus}
            onDelete={remove}
          />
        ) : (
          <TaskBoard
            tasks={filtered}
            onOpen={(t) => setDrawer({ mode: "edit", task: t })}
            onStatusChange={changeStatus}
            onDelete={remove}
            onAdd={(status) => setDrawer({ mode: "create", status })}
          />
        )}
      </div>

      <TaskModal
        state={drawer}
        onClose={() => setDrawer(null)}
        onSubmit={submitDrawer}
        saving={saving}
      />
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-pill px-6 py-2.5 text-[14px] transition-colors",
        active
          ? "bg-border-strong text-fg shadow-[0_1px_3.5px_-1px_#0000000f]"
          : "text-muted hover:text-fg-soft",
      )}
    >
      {label}
      <span className={cn("text-[12px]", active ? "text-fg-soft" : "text-faint")}>
        {count}
      </span>
    </button>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-4 py-1.5 text-[13px] transition-colors",
        active ? "bg-border-strong text-fg" : "text-muted hover:text-fg-soft",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-border-strong text-fg"
          : "bg-surface text-fg-soft hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border text-muted">
        <SquareCheckIcon size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-fg-soft">
          Nenhuma tarefa por aqui
        </p>
        <p className="max-w-xs text-[13px] text-muted">
          Ajuste os filtros ou crie uma nova peça de conteúdo para começar.
        </p>
      </div>
      <Button className="w-fit" onClick={onAdd}>
        <span className="flex items-center gap-1.5">
          <PlusIcon size={16} /> Adicionar tarefa
        </span>
      </Button>
    </div>
  );
}

function insertAt(list: Task[], index: number, item: Task): Task[] {
  const copy = [...list];
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
  return copy;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado.";
}

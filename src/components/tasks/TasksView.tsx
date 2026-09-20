"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { STATUSES } from "@/lib/tasks/constants";
import {
  applyFilters,
  countActiveFilters,
  groupTasks,
  sortTasks,
  DEFAULT_DISPLAY,
  EMPTY_FILTERS,
  type Display,
  type Filters,
} from "@/lib/tasks/view";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import {
  EllipsisIcon,
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
import { TaskModal, type TaskModalState, type TaskModalValues } from "./TaskModal";
import { FilterMenu } from "./FilterMenu";
import { DisplayMenu } from "./DisplayMenu";
import { apiCreateTask, apiDeleteTask, apiUpdateTask } from "./api";

type Tab = TaskStatus | "todas";
type OpenMenu = "filtros" | "visualizacao" | "status-ocultos" | null;

/*
 * As abas de status da Lista mostram só o que está "em jogo" no dia a dia
 * (A fazer, Em progresso, Em revisão); Concluído/Pausado/Cancelado ficam
 * atrás do botão "Mais status" — ver o bloco "status-ocultos" no cabeçalho.
 */
const VISIBLE_TAB_STATUSES = STATUSES.slice(0, 3);
const HIDDEN_TAB_STATUSES = STATUSES.slice(3);

export function TasksView({ initialTasks }: { initialTasks: Task[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [display, setDisplay] = useState<Display>(DEFAULT_DISPLAY);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [tab, setTab] = useState<Tab>("todas");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [drawer, setDrawer] = useState<TaskModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // O input responde na hora; a filtragem da lista roda em prioridade baixa.
  const deferredSearch = useDeferredValue(search);

  const isLista = display.view === "lista";

  // O lápis da sidebar leva para /tarefas?novo=1 — abre o modal e limpa a URL.
  useEffect(() => {
    if (params.get("novo") !== "1") return;
    setDrawer({ mode: "create" });
    router.replace("/tarefas");
  }, [params, router]);

  // "F" abre o menu de filtros, como o atalho desenhado no export.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setMenu((m) => (m === "filtros" ? null : "filtros"));
      } else if (e.key === "Escape") {
        setMenu(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => {
    const base = applyFilters(tasks, filters, deferredSearch, display);
    const byTab =
      isLista && tab !== "todas" ? base.filter((t) => t.status === tab) : base;
    return sortTasks(byTab, display);
  }, [tasks, filters, deferredSearch, display, tab, isLista]);

  const groups = useMemo(
    () => groupTasks(visible, display.group, { showEmpty: display.showEmptyGroups }),
    [visible, display.group, display.showEmptyGroups],
  );

  const counts = useMemo(() => {
    const m = new Map<Tab, number>();
    m.set("todas", tasks.length);
    for (const s of STATUSES) m.set(s.id, 0);
    for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [tasks]);

  const activeFilters = countActiveFilters(filters);
  // Se a tarefa aberta está num status escondido, a aba dele reaparece — só some quando ninguém está olhando.
  const hiddenActiveStatus = HIDDEN_TAB_STATUSES.find((s) => s.id === tab);

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
          ts.some((t) => t.id === task.id) ? ts : insertAt(ts, index, task),
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

  async function submitDrawer(values: TaskModalValues) {
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
    <div className="flex h-full min-h-0 flex-col gap-5 px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      <Breadcrumb
        items={[{ label: "black berry", href: "/tarefas" }, { label: "Tarefas" }]}
      />

      {/*
       * Header row — uma linha só, sempre.
       *
       * Com `flex-wrap`, as abas de status empurravam os botões para uma
       * segunda linha encostada na esquerda; como o painel dos menus abre
       * ancorado à direita do botão (`right-0`) e o `<main>` tem
       * `overflow-hidden`, 168px dos 264px do painel ficavam fora da área
       * visível. Abas rolam na horizontal, botões ficam fixos à direita.
       */}
      <div className="flex min-w-0 flex-nowrap items-center justify-between gap-3">
        {/* Left: tabs (lista) or title (grade) */}
        {isLista ? (
          /*
           * Dois níveis, não um: só as abas roláveis ficam dentro do
           * `overflow-x-auto` (linha 375). Um popover metido ali dentro
           * herda o mesmo corte vertical que a grade do Lote tinha — o
           * `overflow-x-auto` força o eixo Y a virar `auto` também (regra
           * do CSS: um eixo "visible" ao lado de outro que não é vira
           * "auto"), e o painel que abre para BAIXO da linha some cortado.
           * O gatilho "Mais status" é irmão da área rolável, fora do corte.
           */
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
              <Tab
                active={tab === "todas"}
                onClick={() => setTab("todas")}
                label="Todas"
                count={counts.get("todas") ?? 0}
              />
              {VISIBLE_TAB_STATUSES.map((s) => (
                <Tab
                  key={s.id}
                  active={tab === s.id}
                  onClick={() => setTab(s.id)}
                  label={s.label}
                  count={counts.get(s.id) ?? 0}
                />
              ))}

              {/* Aba ativa entre as ocultas: some da tela ao trocar de status, não ao rolar o olho. */}
              {hiddenActiveStatus && (
                <Tab
                  active
                  onClick={() => setTab(hiddenActiveStatus.id)}
                  label={hiddenActiveStatus.label}
                  count={counts.get(hiddenActiveStatus.id) ?? 0}
                />
              )}
            </div>

            {/*
             * Concluído, Pausado e Cancelado não são status do dia a dia —
             * ficam atrás deste botão em vez de brigar por espaço na linha,
             * igual ao resto do produto (menu de filtros, de visualização).
             */}
            <Popover
              open={menu === "status-ocultos"}
              onClose={() => setMenu(null)}
              trigger={
                <button
                  type="button"
                  aria-label="Mais status"
                  aria-haspopup="menu"
                  aria-expanded={menu === "status-ocultos"}
                  onClick={() =>
                    setMenu((m) => (m === "status-ocultos" ? null : "status-ocultos"))
                  }
                  className={cn(
                    "tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                    menu === "status-ocultos" || hiddenActiveStatus
                      ? "bg-border-strong text-fg"
                      : "text-muted hover:bg-surface/60 hover:text-fg-soft",
                  )}
                >
                  <EllipsisIcon size={16} />
                </button>
              }
            >
              <div className="w-[190px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                {HIDDEN_TAB_STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setTab(s.id);
                      setMenu(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-mark px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                      tab === s.id ? "text-fg-soft" : "text-muted",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.dot }}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-faint">
                      {counts.get(s.id) ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </Popover>
          </div>
        ) : (
          /* Quadro — export "2. Board · Kanban": alternador Lista/Quadro */
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            <ViewTab
              active={false}
              label="Lista"
              onClick={() => setDisplay((d) => ({ ...d, view: "lista" }))}
            />
            <ViewTab
              active
              label="Quadro"
              onClick={() => setDisplay((d) => ({ ...d, view: "grade" }))}
            />
          </div>
        )}

        {/* Right: busca + os dois menus + criar */}
        <div className="flex shrink-0 items-center gap-2">
          {/*
           * A busca abre por cima da linha (overlay ancorado à direita) em vez
           * de entrar no fluxo: assim o botão continua redondo e no mesmo lugar.
           */}
          <div className="relative shrink-0">
            {showSearch && (
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setShowSearch(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setShowSearch(false);
                  }
                }}
                placeholder="Buscar tarefa, cliente…"
                className="absolute right-0 top-1/2 h-10 w-[260px] -translate-y-1/2 animate-fade-in rounded-pill border border-border bg-surface pl-4 pr-12 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
              />
            )}
            <IconBtn
              label="Buscar"
              onClick={() => setShowSearch((s) => !s)}
              active={showSearch || !!search}
            >
              <SearchIcon size={16} />
            </IconBtn>
          </div>

          {/* Filtros — export "Filtros · Menu" */}
          <Popover
            open={menu === "filtros"}
            onClose={() => setMenu(null)}
            trigger={
              <IconBtn
                label="Filtros"
                onClick={() => setMenu((m) => (m === "filtros" ? null : "filtros"))}
                active={menu === "filtros" || activeFilters > 0}
                badge={activeFilters || undefined}
              >
                <SlidersIcon size={16} />
              </IconBtn>
            }
          >
            <FilterMenu
              tasks={tasks}
              filters={filters}
              onChange={setFilters}
              onUnavailable={(label) =>
                toast(`O filtro "${label}" chega junto com o campo na tarefa.`, "info")
              }
              onClose={() => setMenu(null)}
            />
          </Popover>

          {/* Visualização — export "Menu de Filtros" */}
          <Popover
            open={menu === "visualizacao"}
            onClose={() => setMenu(null)}
            trigger={
              <IconBtn
                label="Visualização"
                onClick={() =>
                  setMenu((m) => (m === "visualizacao" ? null : "visualizacao"))
                }
                active={menu === "visualizacao"}
              >
                <Settings2Icon size={16} />
              </IconBtn>
            }
          >
            <DisplayMenu display={display} onChange={setDisplay} />
          </Popover>

          {/*
           * Redondo e só com o ícone, como os outros botões do cabeçalho — o
           * rótulo "Adicionar tarefa" vira `title`/`aria-label`. O destaque
           * (bg-primary) é o que separa "criar" de "filtrar"/"ver", sem
           * precisar de texto para isso.
           */}
          <button
            type="button"
            aria-label="Adicionar tarefa"
            title="Adicionar tarefa"
            onClick={() => setDrawer({ mode: "create" })}
            className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-white"
          >
            <PlusIcon size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {visible.length === 0 ? (
          <EmptyState
            onAdd={() => setDrawer({ mode: "create" })}
            filtered={activeFilters > 0 || !!search.trim()}
            onClear={() => {
              setFilters(EMPTY_FILTERS);
              setSearch("");
            }}
          />
        ) : isLista ? (
          <TaskTable
            groups={groups}
            subgroupKey={display.subgroup}
            columns={display.columns}
            perGroup={display.perGroup}
            onOpen={(t) => setDrawer({ mode: "edit", task: t })}
            onStatusChange={changeStatus}
            onDelete={remove}
          />
        ) : (
          <TaskBoard
            tasks={visible}
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

/** Ancora um menu flutuante ao botão que o abriu. */
function Popover({
  open,
  onClose,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50">{children}</div>
        </>
      )}
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
        "tap flex shrink-0 items-center gap-2 rounded-pill px-6 py-2.5 text-[14px] transition-colors",
        active
          ? "bg-border-strong text-fg shadow-[0_1px_3.5px_-1px_#0000000f]"
          : "text-muted hover:bg-surface/60 hover:text-fg-soft",
      )}
    >
      {label}
      <span
        key={count}
        className={cn(
          "animate-rise-in-sm text-[12px]",
          active ? "text-fg-soft" : "text-faint",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Pílula Lista/Quadro do export "2. Board · Kanban" — ativa: bg #414141,
 * texto branco e a sombra de 1px do desenho.
 */
function ViewTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap flex shrink-0 items-center rounded-pill px-6 py-2.5 text-[14px] transition-colors",
        active
          ? "bg-border-strong text-fg shadow-[0_1px_3.5px_-1px_#0000000f]"
          : "text-muted hover:bg-surface/60 hover:text-fg-soft",
      )}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  active,
  badge,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        // shrink-0: sem isso o flex achatava o botão (deixava de ser redondo).
        "tap relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-border-strong text-fg"
          : "bg-surface text-fg-soft hover:bg-surface-2",
      )}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-scale-in items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-semibold text-on-primary">
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({
  onAdd,
  filtered,
  onClear,
}: {
  onAdd: () => void;
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex h-full animate-rise-in flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-border text-muted">
        <SquareCheckIcon size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-fg-soft">
          Nenhuma tarefa por aqui
        </p>
        <p className="max-w-xs text-[13px] text-muted">
          {filtered
            ? "Nenhuma tarefa corresponde aos filtros aplicados."
            : "Crie uma nova peça de conteúdo para começar."}
        </p>
      </div>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="tap rounded-pill border border-border px-4 py-2 text-[13px] text-fg-soft transition-colors hover:bg-surface"
        >
          Limpar filtros
        </button>
      ) : (
        <Button className="w-fit" onClick={onAdd}>
          <span className="flex items-center gap-1.5">
            <PlusIcon size={16} /> Adicionar tarefa
          </span>
        </Button>
      )}
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

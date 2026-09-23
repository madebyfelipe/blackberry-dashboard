"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { Screen, ScreenAction, ScreenHeader, ScreenIconAction } from "@/components/ui/Screen";
import { TabStrip, Tab, type TabOption } from "@/components/ui/Tabs";
import {
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarSearch,
} from "@/components/ui/Toolbar";
import { SelectionBar } from "@/components/ui/SelectionBar";
import {
  ArchiveIcon,
  EllipsisIcon,
  GitBranchIcon,
  PlusIcon,
  ShareIcon,
  SlidersIcon,
  Settings2Icon,
  SquareCheckIcon,
  TrashIcon,
} from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { TaskTable } from "./TaskTable";
import { TaskBoard } from "./TaskBoard";
import { TaskModal, type TaskModalState, type TaskModalValues } from "./TaskModal";
import { FilterMenu } from "./FilterMenu";
import { DisplayMenu } from "./DisplayMenu";
import { Popover } from "@/components/ui/Popover";
import { apiCreateTask, apiDeleteTask, apiUpdateTask } from "./api";

type StatusTab = TaskStatus | "todas";
type OpenMenu = "filtros" | "visualizacao" | null;

/*
 * As abas de status da Lista mostram só o que está "em jogo" no dia a dia;
 * Pausado e Cancelado ficam atrás do "..." do desenho.
 */
const VISIBLE_TAB_STATUSES = STATUSES.slice(0, 4);
const HIDDEN_TAB_STATUSES = STATUSES.slice(4);

export function TasksView({ initialTasks }: { initialTasks: Task[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [display, setDisplay] = useState<Display>(DEFAULT_DISPLAY);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [tab, setTab] = useState<StatusTab>("todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<TaskModalState | null>(null);
  const [saving, setSaving] = useState(false);
  // O input responde na hora; a filtragem da lista roda em prioridade baixa.
  const deferredSearch = useDeferredValue(search);

  const isLista = display.view === "lista";

  // As ações rápidas da lateral levam para /tarefas?novo=1.
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
    const m = new Map<StatusTab, number>();
    m.set("todas", tasks.length);
    for (const s of STATUSES) m.set(s.id, 0);
    for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [tasks]);

  const activeFilters = countActiveFilters(filters);

  /*
   * A seleção vive sobre o que está em tela: filtrar ou trocar de aba não
   * pode deixar para trás uma linha marcada que ninguém mais vê (e que as
   * ações da barra atingiriam às cegas).
   */
  const visibleIds = useMemo(() => visible.map((t) => t.id), [visible]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(visibleIds.filter((id) => prev.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (next: boolean) => setSelected(next ? new Set(visibleIds) : new Set()),
    [visibleIds],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // ---- mutations (otimistas) ----

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

  /**
   * Exclusão adiada: some da tela na hora, oferece desfazer e só chama a API
   * se o toast expirar sem ninguém desfazer.
   */
  function removeMany(doomed: Task[]) {
    if (doomed.length === 0) return;
    const before = tasks;
    const ids = new Set(doomed.map((t) => t.id));
    setTasks((ts) => ts.filter((t) => !ids.has(t.id)));
    clearSelection();

    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        await Promise.all(doomed.map((t) => apiDeleteTask(t.id)));
      } catch (e) {
        setTasks(before);
        toast(errMsg(e), "error");
      }
    }, 4200);

    toast(
      doomed.length === 1
        ? "Tarefa excluída."
        : `${doomed.length} tarefas excluídas.`,
      "success",
      {
        duration: 4000,
        action: {
          label: "Desfazer",
          onClick: () => {
            undone = true;
            clearTimeout(timer);
            setTasks(before);
          },
        },
      },
    );
  }

  async function submitDrawer(values: TaskModalValues) {
    if (!drawer) return;
    setSaving(true);
    try {
      if (drawer.mode === "create") {
        const created = await apiCreateTask(values);
        setTasks((ts) => [created, ...ts]);
        setDrawer(null);
        toast("Tarefa criada.");
        /*
         * Criar leva direto para a descrição da tarefa: é lá que ela ganha
         * corpo (descrição, propriedades, conversa), e o modal só dá o
         * empurrão inicial.
         */
        router.push(`/tarefas/${created.id}`);
        return;
      }
      const updated = await apiUpdateTask(drawer.task.id, values);
      setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)));
      toast("Alterações salvas.");
      setDrawer(null);
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setSaving(false);
    }
  }

  const statusTabs: TabOption[] = [
    { id: "todas", label: "Todas", count: counts.get("todas") ?? 0 },
    ...VISIBLE_TAB_STATUSES.map((s) => ({
      id: s.id,
      label: s.label,
      count: counts.get(s.id) ?? 0,
    })),
  ];
  const hiddenTabs: TabOption[] = HIDDEN_TAB_STATUSES.map((s) => ({
    id: s.id,
    label: s.label,
    count: counts.get(s.id) ?? 0,
  }));

  const [moreOpen, setMoreOpen] = useState(false);

  const soon = (what: string) =>
    toast(`"${what}" chega junto com o recurso no produto.`, "info");

  return (
    <Screen>
      <Breadcrumb
        items={[{ label: "black berry", href: "/tarefas" }, { label: "Tarefas" }]}
      />

      <ScreenHeader
        actions={
          <>
            <ScreenAction onClick={() => setDrawer({ mode: "create" })}>
              Nova tarefa
            </ScreenAction>
            {/* Os "3 pontinhos": por ora, a porta para a esteira das tarefas. */}
            <Popover
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              trigger={
                <ScreenIconAction
                  label="Mais ações"
                  onClick={() => setMoreOpen((o) => !o)}
                >
                  <EllipsisIcon size={16} />
                </ScreenIconAction>
              }
            >
              <div
                role="menu"
                className="w-[220px] animate-pop-in rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  autoFocus
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/configuracoes/fluxos");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-row-raised focus-visible:bg-row-raised focus-visible:outline-none"
                >
                  <GitBranchIcon size={15} className="text-fg-3" />
                  Fluxos e Processos
                </button>
              </div>
            </Popover>
          </>
        }
      >
        {isLista ? (
          <TabStrip
            tabs={statusTabs}
            overflow={hiddenTabs}
            active={tab}
            onSelect={(id) => setTab(id as StatusTab)}
            overflowLabel="Mais status"
          />
        ) : (
          /* Quadro — o export troca as abas de status pelo par Lista/Quadro */
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            <Tab
              id="lista"
              label="Lista"
              active={false}
              onClick={() => setDisplay((d) => ({ ...d, view: "lista" }))}
            />
            <Tab
              id="grade"
              label="Quadro"
              active
              onClick={() => setDisplay((d) => ({ ...d, view: "grade" }))}
            />
          </div>
        )}
      </ScreenHeader>

      {/* Corpo: barra de ferramentas + lista/quadro */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <Toolbar
          right={
            <Popover
              open={menu === "visualizacao"}
              onClose={() => setMenu(null)}
              align="right"
              trigger={
                <ToolbarButton
                  icon={<Settings2Icon size={15} />}
                  label="Personalizar"
                  active={menu === "visualizacao"}
                  aria-haspopup="menu"
                  aria-expanded={menu === "visualizacao"}
                  onClick={() =>
                    setMenu((m) => (m === "visualizacao" ? null : "visualizacao"))
                  }
                />
              }
            >
              <DisplayMenu display={display} onChange={setDisplay} />
            </Popover>
          }
        >
          <Popover
            open={menu === "filtros"}
            onClose={() => setMenu(null)}
            align="left"
            trigger={
              <ToolbarButton
                icon={<SlidersIcon size={15} />}
                label="Filtros"
                active={menu === "filtros" || activeFilters > 0}
                badge={activeFilters || undefined}
                aria-haspopup="menu"
                aria-expanded={menu === "filtros"}
                onClick={() => setMenu((m) => (m === "filtros" ? null : "filtros"))}
              />
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

          <ToolbarDivider />

          <ToolbarSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar tarefas"
          />
        </Toolbar>

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
              selected={selected}
              onToggle={toggleOne}
              onToggleAll={toggleAll}
              allSelected={
                visibleIds.length > 0 && selectedVisible.length === visibleIds.length
              }
              someSelected={selectedVisible.length > 0}
              onOpen={(t) => router.push(`/tarefas/${t.id}`)}
            />
          ) : (
            <TaskBoard
              tasks={visible}
              onOpen={(t) => router.push(`/tarefas/${t.id}`)}
              onStatusChange={changeStatus}
              onDelete={(t) => removeMany([t])}
              onAdd={(status) => setDrawer({ mode: "create", status })}
            />
          )}
        </div>

        {isLista && (
          <SelectionBar
            count={selectedVisible.length}
            noun={["tarefa selecionada", "tarefas selecionadas"]}
            onClear={clearSelection}
            actions={[
              {
                label: "Exportar",
                icon: <ShareIcon size={16} />,
                onSelect: () => soon("Exportar"),
              },
              {
                label: "Arquivar",
                icon: <ArchiveIcon size={16} />,
                onSelect: () => soon("Arquivar"),
              },
              {
                label: "Excluir",
                icon: <TrashIcon size={16} />,
                danger: true,
                onSelect: () =>
                  removeMany(tasks.filter((t) => selected.has(t.id))),
              },
              {
                label: "Mais",
                icon: <EllipsisIcon size={16} />,
                onSelect: () => soon("Mais ações da seleção"),
              },
            ]}
          />
        )}
      </div>

      <TaskModal
        state={drawer}
        onClose={() => setDrawer(null)}
        onSubmit={submitDrawer}
        saving={saving}
      />
    </Screen>
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
    <div className="flex h-full animate-rise-in flex-col items-center justify-center gap-4 text-center">
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
          className="tap rounded-pill border border-border px-4 py-2 text-[13px] text-fg-soft transition-colors hover:bg-surface-2"
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado.";
}

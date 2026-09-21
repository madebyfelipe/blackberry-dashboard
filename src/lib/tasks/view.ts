import type { Task, TaskPriority, TaskStatus } from "./types";
import { STATUSES, STATUS_BY_ID } from "./constants";
import { PRIORITIES, PRIORITY_BY_ID, priorityRank } from "./priority";

/*
 * Estado das duas telas-menu do design (exports "Filtros · Menu" e
 * "Menu de Filtros"): o que filtra a lista e o que muda a visualização.
 * Nenhuma view guarda dados — todas leem daqui e de `constants.ts`.
 */

export type TaskView = "lista" | "grade";
export type GroupKey =
  | "nenhum"
  | "status"
  | "assignee"
  | "client"
  | "priority";
export type SortKey =
  | "pendentes"
  | "prioridade"
  | "prazo"
  | "recentes"
  | "antigas"
  | "az";
export type ColumnKey =
  | "status"
  | "client"
  | "assignee"
  | "createdAt"
  | "priority"
  | "dueDate"
  | "labels"
  | "id";
export type DateRange = "qualquer" | "hoje" | "7d" | "30d";
/** Janela do prazo interno — inclui o caso que só o prazo tem: atrasadas. */
export type DueRange = "qualquer" | "atrasadas" | "hoje" | "7d" | "sem-prazo";

export type Filters = {
  status: TaskStatus[];
  assignee: string[];
  client: string[];
  priority: TaskPriority[];
  labels: string[];
  creator: string[];
  created: DateRange;
  due: DueRange;
};

export type Display = {
  view: TaskView;
  group: GroupKey;
  subgroup: GroupKey;
  sort: SortKey;
  /** "Ordenar em dia por recência": desempata tarefas do mesmo dia pela mais recente. */
  recencyTiebreak: boolean;
  /** "Mostrar arquivados": no pipeline de tarefas, arquivada = cancelada. */
  showArchived: boolean;
  /** "Tarefas por grupo": limite de linhas antes do "ver mais". */
  perGroup: number | "todas";
  showEmptyGroups: boolean;
  columns: ColumnKey[];
};

export const EMPTY_FILTERS: Filters = {
  status: [],
  assignee: [],
  client: [],
  priority: [],
  labels: [],
  creator: [],
  created: "qualquer",
  due: "qualquer",
};

export const DEFAULT_DISPLAY: Display = {
  view: "lista",
  group: "nenhum",
  subgroup: "nenhum",
  sort: "pendentes",
  recencyTiebreak: true,
  showArchived: true,
  perGroup: "todas",
  showEmptyGroups: false,
  // O export "Tarefas · Painel (Lista)" desenha STATUS, RESPONSÁVEL e
  // PRAZO; o cliente não tem coluna — é a segunda linha da célula TAREFA.
  columns: ["status", "client", "assignee", "dueDate"],
};

export const GROUP_OPTIONS: { id: GroupKey; label: string }[] = [
  { id: "nenhum", label: "Sem agrupamento" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Responsável" },
  { id: "client", label: "Cliente" },
  { id: "priority", label: "Prioridade" },
];

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "pendentes", label: "Pendentes" },
  { id: "prioridade", label: "Prioridade" },
  { id: "prazo", label: "Prazo" },
  { id: "recentes", label: "Mais recentes" },
  { id: "antigas", label: "Mais antigas" },
  { id: "az", label: "A–Z" },
];

export const PER_GROUP_OPTIONS: { id: number | "todas"; label: string }[] = [
  { id: "todas", label: "Mostrar todas" },
  { id: 5, label: "Mostrar 5" },
  { id: 10, label: "Mostrar 10" },
];

export const COLUMN_OPTIONS: { id: ColumnKey; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "client", label: "Cliente" },
  { id: "assignee", label: "Responsável" },
  { id: "priority", label: "Prioridade" },
  { id: "dueDate", label: "Prazo" },
  { id: "labels", label: "Etiquetas" },
  { id: "createdAt", label: "Criado em" },
  { id: "id", label: "ID" },
];

export const DATE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: "qualquer", label: "Qualquer data" },
  { id: "hoje", label: "Criadas hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
];

export const DUE_OPTIONS: { id: DueRange; label: string }[] = [
  { id: "qualquer", label: "Qualquer prazo" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "hoje", label: "Vencem hoje" },
  { id: "7d", label: "Próximos 7 dias" },
  { id: "sem-prazo", label: "Sem prazo" },
];

export function countActiveFilters(f: Filters): number {
  return (
    f.status.length +
    f.assignee.length +
    f.client.length +
    f.priority.length +
    f.labels.length +
    f.creator.length +
    (f.created === "qualquer" ? 0 : 1) +
    (f.due === "qualquer" ? 0 : 1)
  );
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function withinRange(iso: string, range: DateRange): boolean {
  if (range === "qualquer") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range === "hoje") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  const days = range === "7d" ? 7 : 30;
  return t >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** "Atrasada" é prazo já vencido em tarefa que ainda está em jogo. */
export function isOverdue(t: Task): boolean {
  if (!t.dueDate) return false;
  if (t.status === "concluido" || t.status === "cancelado") return false;
  return new Date(t.dueDate).getTime() < Date.now();
}

function withinDue(t: Task, range: DueRange): boolean {
  if (range === "qualquer") return true;
  if (range === "sem-prazo") return !t.dueDate;
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate).getTime();
  if (Number.isNaN(due)) return false;
  if (range === "atrasadas") return isOverdue(t);
  if (range === "hoje") return due <= endOfToday() && due >= Date.now() - 86_400_000;
  return due <= Date.now() + 7 * 86_400_000;
}

export function applyFilters(
  tasks: Task[],
  filters: Filters,
  search: string,
  display: Display,
): Task[] {
  const q = search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (!display.showArchived && t.status === "cancelado") return false;
    if (filters.status.length && !filters.status.includes(t.status)) return false;
    if (filters.assignee.length && !filters.assignee.includes(t.assignee)) return false;
    if (filters.client.length && !filters.client.includes(t.client)) return false;
    if (filters.priority.length && !filters.priority.includes(t.priority)) return false;
    if (filters.creator.length && !filters.creator.includes(t.creator)) return false;
    // Etiquetas: a tarefa precisa ter pelo menos uma das selecionadas.
    if (filters.labels.length && !filters.labels.some((l) => t.labels.includes(l))) {
      return false;
    }
    if (!withinRange(t.createdAt, filters.created)) return false;
    if (!withinDue(t, filters.due)) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.client.toLowerCase().includes(q) ||
      t.assignee.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.labels.some((l) => l.toLowerCase().includes(q))
    );
  });
}

const STATUS_ORDER = new Map(STATUSES.map((s, i) => [s.id, i]));

/** Status ainda "em jogo" vêm primeiro na ordenação "Pendentes". */
function pendingWeight(t: Task): number {
  if (t.status === "concluido" || t.status === "cancelado") return 1;
  return 0;
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * Ordena em um único comparador: dia primeiro, depois o desempate.
 * "Ordenar em dia por recência" (toggle do menu) decide o desempate dentro do
 * mesmo dia — recência quando ligado, ordem do pipeline + título quando não.
 */
export function sortTasks(tasks: Task[], display: Display): Task[] {
  const time = (t: Task) => new Date(t.createdAt).getTime() || 0;
  const rank = (t: Task) => STATUS_ORDER.get(t.status) ?? 99;
  const tiebreak = (a: Task, b: Task) =>
    display.recencyTiebreak
      ? time(b) - time(a)
      : rank(a) - rank(b) || a.title.localeCompare(b.title, "pt-BR");

  const dueTime = (t: Task) =>
    t.dueDate ? new Date(t.dueDate).getTime() || Infinity : Infinity;

  const out = [...tasks];
  out.sort((a, b) => {
    if (display.sort === "az") return a.title.localeCompare(b.title, "pt-BR");
    if (display.sort === "prioridade") {
      const p = priorityRank(a.priority) - priorityRank(b.priority);
      if (p !== 0) return p;
      return time(b) - time(a);
    }
    if (display.sort === "prazo") {
      // Sem prazo vai para o fim; empate volta para a recência.
      const d = dueTime(a) - dueTime(b);
      if (d !== 0 && Number.isFinite(d)) return d;
      if (dueTime(a) !== dueTime(b)) return dueTime(a) - dueTime(b);
      return time(b) - time(a);
    }
    if (display.sort === "pendentes") {
      const w = pendingWeight(a) - pendingWeight(b);
      if (w !== 0) return w;
      const s = rank(a) - rank(b);
      if (s !== 0) return s;
    }
    if (!sameDay(a.createdAt, b.createdAt)) {
      return display.sort === "antigas" ? time(a) - time(b) : time(b) - time(a);
    }
    return tiebreak(a, b);
  });
  return out;
}

export type Group = {
  key: string;
  label: string;
  tasks: Task[];
};

function groupLabel(key: GroupKey, task: Task): { key: string; label: string } {
  switch (key) {
    case "status":
      return { key: task.status, label: STATUS_BY_ID[task.status].label };
    case "assignee":
      return { key: task.assignee || "—", label: task.assignee || "Sem responsável" };
    case "client":
      return { key: task.client || "—", label: task.client || "Sem cliente" };
    case "priority":
      return {
        key: task.priority,
        label: PRIORITY_BY_ID[task.priority].label,
      };
    default:
      return { key: "todas", label: "Todas" };
  }
}

/** Agrupa mantendo a ordem do pipeline quando o agrupamento é por status. */
export function groupTasks(
  tasks: Task[],
  key: GroupKey,
  opts?: { showEmpty?: boolean },
): Group[] {
  if (key === "nenhum") return [{ key: "todas", label: "Todas", tasks }];

  const map = new Map<string, Group>();
  if (key === "status" && opts?.showEmpty) {
    for (const s of STATUSES) map.set(s.id, { key: s.id, label: s.label, tasks: [] });
  }
  if (key === "priority" && opts?.showEmpty) {
    for (const p of PRIORITIES) map.set(p.id, { key: p.id, label: p.label, tasks: [] });
  }
  for (const t of tasks) {
    const { key: k, label } = groupLabel(key, t);
    const g = map.get(k) ?? { key: k, label, tasks: [] };
    g.tasks.push(t);
    map.set(k, g);
  }
  const groups = [...map.values()];
  if (key === "status") {
    groups.sort(
      (a, b) =>
        (STATUS_ORDER.get(a.key as TaskStatus) ?? 99) -
        (STATUS_ORDER.get(b.key as TaskStatus) ?? 99),
    );
  } else if (key === "priority") {
    groups.sort(
      (a, b) =>
        priorityRank(a.key as TaskPriority) - priorityRank(b.key as TaskPriority),
    );
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  return opts?.showEmpty ? groups : groups.filter((g) => g.tasks.length > 0);
}

/** Valores distintos de um campo, para montar os submenus de filtro. */
export function distinct(
  tasks: Task[],
  field: "assignee" | "client" | "creator",
): string[] {
  return [...new Set(tasks.map((t) => t[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

/** Etiquetas em uso, para o submenu "Etiquetas". */
export function distinctLabels(tasks: Task[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.labels))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

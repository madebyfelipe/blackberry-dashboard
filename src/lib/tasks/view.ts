import type { Task, TaskStatus } from "./types";
import { STATUSES, STATUS_BY_ID } from "./constants";

/*
 * Estado das duas telas-menu do design (exports "Filtros · Menu" e
 * "Menu de Filtros"): o que filtra a lista e o que muda a visualização.
 * Nenhuma view guarda dados — todas leem daqui e de `constants.ts`.
 */

export type TaskView = "lista" | "grade";
export type GroupKey = "nenhum" | "status" | "assignee" | "client";
export type SortKey = "pendentes" | "recentes" | "antigas" | "az";
export type ColumnKey = "status" | "client" | "assignee" | "createdAt" | "id";
export type DateRange = "qualquer" | "hoje" | "7d" | "30d";

export type Filters = {
  status: TaskStatus[];
  assignee: string[];
  client: string[];
  created: DateRange;
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
  created: "qualquer",
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
  columns: ["status", "client", "assignee", "createdAt"],
};

export const GROUP_OPTIONS: { id: GroupKey; label: string }[] = [
  { id: "nenhum", label: "Sem agrupamento" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Responsável" },
  { id: "client", label: "Cliente" },
];

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "pendentes", label: "Pendentes" },
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
  { id: "createdAt", label: "Criado em" },
  { id: "id", label: "ID" },
];

export const DATE_OPTIONS: { id: DateRange; label: string }[] = [
  { id: "qualquer", label: "Qualquer data" },
  { id: "hoje", label: "Criadas hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
];

export function countActiveFilters(f: Filters): number {
  return (
    f.status.length +
    f.assignee.length +
    f.client.length +
    (f.created === "qualquer" ? 0 : 1)
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
    if (!withinRange(t.createdAt, filters.created)) return false;
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.client.toLowerCase().includes(q) ||
      t.assignee.toLowerCase().includes(q)
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

  const out = [...tasks];
  out.sort((a, b) => {
    if (display.sort === "az") return a.title.localeCompare(b.title, "pt-BR");
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
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  return opts?.showEmpty ? groups : groups.filter((g) => g.tasks.length > 0);
}

/** Valores distintos de um campo, para montar os submenus de filtro. */
export function distinct(tasks: Task[], field: "assignee" | "client"): string[] {
  return [...new Set(tasks.map((t) => t[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

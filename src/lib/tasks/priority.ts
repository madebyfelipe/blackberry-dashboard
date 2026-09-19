import type { TaskPriority } from "./types";

export type PriorityMeta = {
  id: TaskPriority;
  label: string;
  /** Altura das barrinhas do ícone (0–3) — leitura rápida na lista. */
  bars: number;
};

/**
 * Régua de prioridade — fonte única, como `constants.ts` é para o status.
 * A ordem do array é a ordem de urgência (mais urgente primeiro).
 */
export const PRIORITIES: PriorityMeta[] = [
  { id: "urgente", label: "Urgente", bars: 3 },
  { id: "alta", label: "Alta", bars: 3 },
  { id: "media", label: "Média", bars: 2 },
  { id: "baixa", label: "Baixa", bars: 1 },
  { id: "sem", label: "Sem prioridade", bars: 0 },
];

export const PRIORITY_BY_ID: Record<TaskPriority, PriorityMeta> =
  Object.fromEntries(PRIORITIES.map((p) => [p.id, p])) as Record<
    TaskPriority,
    PriorityMeta
  >;

export function isTaskPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && v in PRIORITY_BY_ID;
}

/** "sem" é o padrão e não vira chip/pílula em lugar nenhum. */
export function isRealPriority(
  p: TaskPriority,
): p is Exclude<TaskPriority, "sem"> {
  return p !== "sem";
}

const RANK = new Map(PRIORITIES.map((p, i) => [p.id, i]));

export function priorityRank(p: TaskPriority): number {
  return RANK.get(p) ?? PRIORITIES.length;
}

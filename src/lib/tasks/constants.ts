import type { TaskStatus } from "./types";

export type StatusMeta = {
  id: TaskStatus;
  label: string;
  /** Monochrome dot/ring color, straight from the black berry design. */
  dot: string;
};

/**
 * Single source of truth for the task pipeline. Every view (List tabs, Board
 * columns, pills) derives from this array and its order. To change the
 * pipeline, edit ONLY this file.
 *
 * Colors follow the pen.dev export (Lista·Tabela dots): monochrome grays.
 */
export const STATUSES: StatusMeta[] = [
  { id: "a-fazer", label: "A fazer", dot: "#888888" },
  { id: "em-progresso", label: "Em progresso", dot: "#c9c9c9" },
  { id: "em-revisao", label: "Em revisão", dot: "#e0e0e0" },
  { id: "concluido", label: "Concluído", dot: "#565656" },
  { id: "pausado", label: "Pausado", dot: "#5a5a5a" },
  { id: "cancelado", label: "Cancelado", dot: "#404040" },
];

export const STATUS_BY_ID: Record<TaskStatus, StatusMeta> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
) as Record<TaskStatus, StatusMeta>;

export function statusLabel(id: TaskStatus): string {
  return STATUS_BY_ID[id]?.label ?? id;
}

export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && v in STATUS_BY_ID;
}

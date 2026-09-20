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
 * A cor de cada ponto é o token `--color-status-*` de `globals.css` — a
 * paleta mora lá inteira, e aqui fica só o pipeline. Vai para `style`, então
 * `var()` resolve no elemento.
 */
export const STATUSES: StatusMeta[] = [
  { id: "a-fazer", label: "A fazer", dot: "var(--color-status-todo)" },
  { id: "em-progresso", label: "Em progresso", dot: "var(--color-status-progress)" },
  { id: "em-revisao", label: "Em revisão", dot: "var(--color-status-review)" },
  { id: "concluido", label: "Concluído", dot: "var(--color-status-done)" },
  { id: "pausado", label: "Pausado", dot: "var(--color-status-paused)" },
  { id: "cancelado", label: "Cancelado", dot: "var(--color-status-canceled)" },
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

import { read, transaction } from "./store";
import { isTaskStatus } from "./constants";
import { isTaskPriority } from "./priority";
import type { NewTask, Task, TaskPatch } from "./types";

/** Everything in the app reads/writes tasks through this module. */

export async function listTasks(): Promise<Task[]> {
  const tasks = await read();
  // Newest first by creation date.
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await read()).find((t) => t.id === id);
}

function makeId(): string {
  return "t" + Math.random().toString(36).slice(2, 9);
}

/** Etiquetas: sem "#", sem espaço, sem repetição, no máximo 8. */
function cleanLabels(input: unknown): string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,]+/)
      : [];
  const out: string[] = [];
  for (const raw of list) {
    const label = String(raw).trim().replace(/^#/, "").slice(0, 24);
    if (label && !out.includes(label)) out.push(label);
    if (out.length === 8) break;
  }
  return out;
}

/** Prazo: ISO válido ou `null`. Data inválida é erro, não silêncio. */
function cleanDueDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ValidationError("Prazo inválido.");
  return d.toISOString();
}

export async function createTask(input: NewTask): Promise<Task> {
  const title = input.title?.trim();
  if (!title) throw new ValidationError("Título é obrigatório.");
  const client = (input.client ?? "").trim();
  const status = isTaskStatus(input.status) ? input.status : "a-fazer";
  const assignee = (input.assignee ?? "").trim() || "—";
  const priority = isTaskPriority(input.priority) ? input.priority : "sem";

  const task: Task = {
    id: makeId(),
    title,
    client,
    status,
    assignee,
    createdAt: new Date().toISOString(),
    description: (input.description ?? "").trim(),
    priority,
    labels: cleanLabels(input.labels),
    creator: (input.creator ?? "").trim() || "—",
    dueDate: cleanDueDate(input.dueDate),
  };
  return transaction((tasks) => {
    tasks.unshift(task);
    return task;
  });
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
): Promise<Task | undefined> {
  if (patch.status !== undefined && !isTaskStatus(patch.status)) {
    throw new ValidationError("Status inválido.");
  }
  if (patch.priority !== undefined && !isTaskPriority(patch.priority)) {
    throw new ValidationError("Prioridade inválida.");
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new ValidationError("Título não pode ficar vazio.");
  }
  // Valida o prazo antes de abrir a transação.
  const dueDate =
    patch.dueDate === undefined ? undefined : cleanDueDate(patch.dueDate);

  return transaction((tasks) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return undefined;
    if (patch.title !== undefined) t.title = patch.title.trim();
    if (patch.client !== undefined) t.client = patch.client.trim();
    if (patch.status !== undefined) t.status = patch.status;
    if (patch.assignee !== undefined) t.assignee = patch.assignee.trim() || "—";
    if (patch.description !== undefined) t.description = patch.description.trim();
    if (patch.priority !== undefined) t.priority = patch.priority;
    if (patch.labels !== undefined) t.labels = cleanLabels(patch.labels);
    if (patch.creator !== undefined) t.creator = patch.creator.trim() || "—";
    if (dueDate !== undefined) t.dueDate = dueDate;
    return { ...t, labels: [...t.labels] };
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  return transaction((tasks) => {
    const i = tasks.findIndex((x) => x.id === id);
    if (i === -1) return false;
    tasks.splice(i, 1);
    return true;
  });
}

export class ValidationError extends Error {}

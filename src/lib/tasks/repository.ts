import { read, transaction } from "./store";
import { isTaskStatus } from "./constants";
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

export async function createTask(input: NewTask): Promise<Task> {
  const title = input.title?.trim();
  if (!title) throw new ValidationError("Título é obrigatório.");
  const client = (input.client ?? "").trim();
  const status = isTaskStatus(input.status) ? input.status : "a-fazer";
  const assignee = (input.assignee ?? "").trim() || "—";

  const task: Task = {
    id: makeId(),
    title,
    client,
    status,
    assignee,
    createdAt: new Date().toISOString(),
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
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new ValidationError("Título não pode ficar vazio.");
  }
  return transaction((tasks) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return undefined;
    if (patch.title !== undefined) t.title = patch.title.trim();
    if (patch.client !== undefined) t.client = patch.client.trim();
    if (patch.status !== undefined) t.status = patch.status;
    if (patch.assignee !== undefined) t.assignee = patch.assignee.trim() || "—";
    return { ...t };
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

import type { NewTask, Task, TaskPatch } from "@/lib/tasks/types";

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Algo deu errado. Tente de novo.");
  }
  return data;
}

export async function apiListTasks(): Promise<Task[]> {
  const data = await parse(await fetch("/api/tasks", { cache: "no-store" }));
  return data.tasks as Task[];
}

export async function apiCreateTask(input: NewTask): Promise<Task> {
  const data = await parse(
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.task as Task;
}

export async function apiUpdateTask(
  id: string,
  patch: TaskPatch,
): Promise<Task> {
  const data = await parse(
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return data.task as Task;
}

export async function apiDeleteTask(id: string): Promise<void> {
  await parse(await fetch(`/api/tasks/${id}`, { method: "DELETE" }));
}

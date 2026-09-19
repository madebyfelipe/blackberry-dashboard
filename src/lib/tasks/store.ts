import { createJsonStore } from "@/lib/store/json-file";
import type { Task } from "./types";
import { isTaskPriority } from "./priority";
import { seedTasks } from "./seed";

/*
 * Armazenamento das tarefas. O app só conversa com `repository.ts`, que só
 * conversa com este arquivo — trocar o armazenamento (Postgres na Vercel) é um
 * drop-in aqui. A mecânica de arquivo + memória vive em `lib/store/json-file`.
 * Ver memória: ragick-persistence-deploy.
 */

/**
 * Migração de leitura: arquivos gravados antes dos campos novos (descrição,
 * prioridade, etiquetas, criador, prazo) continuam válidos — o que faltar
 * entra com o padrão. Assim nenhum consumidor precisa tratar `undefined`.
 */
function normalize(raw: Partial<Task> & { id: string }): Task {
  return {
    id: raw.id,
    title: raw.title ?? "",
    client: raw.client ?? "",
    status: raw.status ?? "a-fazer",
    assignee: raw.assignee ?? "—",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    description: raw.description ?? "",
    priority: isTaskPriority(raw.priority) ? raw.priority : "sem",
    labels: Array.isArray(raw.labels) ? raw.labels.filter(Boolean) : [],
    creator: raw.creator ?? "—",
    dueDate: raw.dueDate ?? null,
  };
}

const store = createJsonStore<Task[]>({
  file: "tasks.json",
  seed: seedTasks,
  revive: (raw) => (raw as (Partial<Task> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

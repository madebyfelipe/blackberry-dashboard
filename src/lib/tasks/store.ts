import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import type { Task, TaskComment } from "./types";
import { isTaskPriority } from "./priority";
import { seedTasks } from "./seed";

/*
 * Armazenamento das tarefas. O app só conversa com `repository.ts`, que só
 * conversa com este arquivo — o backend (arquivo local ou Postgres) é decidido
 * em `lib/store/index.ts`, por `DATABASE_URL`. Ver memória: ragick-persistence-deploy.
 */

/**
 * Migração de leitura: arquivos gravados antes dos campos novos (descrição,
 * prioridade, etiquetas, criador, prazo, comentários) continuam válidos — o que faltar
 * entra com o padrão. Assim nenhum consumidor precisa tratar `undefined`.
 *
 * A agência entra pela mesma porta: tarefa gravada antes do multi-tenant não
 * tem dono, e o único dono possível é a agência semeada — a que estava usando
 * o app. Ninguém perde tarefa, e ninguém herda tarefa dos outros.
 */
function normalize(raw: Partial<Task> & { id: string }): Task {
  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
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
    comments: normalizeComments(raw.comments),
  };
}

/** Conversa gravada antes da tela de descrição: não existe, e vira lista vazia. */
function normalizeComments(raw: unknown): TaskComment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is TaskComment => !!c && typeof c === "object")
    .map((c) => ({
      id: String(c.id ?? ""),
      author: String(c.author ?? "—"),
      text: String(c.text ?? ""),
      createdAt: String(c.createdAt ?? new Date().toISOString()),
    }))
    .filter((c) => c.id && c.text);
}

const store = createStore<Task[]>({
  file: "tasks.json",
  seed: seedTasks,
  revive: (raw) => (raw as (Partial<Task> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

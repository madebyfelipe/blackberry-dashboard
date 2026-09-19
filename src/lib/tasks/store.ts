import { promises as fs } from "node:fs";
import path from "node:path";
import type { Task } from "./types";
import { isTaskPriority } from "./priority";
import { seedTasks } from "./seed";

/*
 * Storage layer. The whole app talks only to repository.ts, which talks only
 * to this file — so swapping storage (e.g. Postgres for Vercel) is a drop-in
 * change here. See memory: ragick-persistence-deploy.
 *
 * Strategy: JSON file when the filesystem is writable (local dev), with an
 * in-memory fallback when it is not (serverless / read-only, e.g. Vercel).
 * The in-memory cache is authoritative within a process once loaded.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

let cache: Task[] | null = null;
let canPersist = true;

async function persist(tasks: Task[]): Promise<void> {
  if (!canPersist) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  } catch {
    // Read-only FS (serverless): keep everything in memory for this instance.
    canPersist = false;
  }
}

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

async function load(): Promise<Task[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as (Partial<Task> & { id: string })[];
    cache = parsed.map(normalize);
  } catch {
    cache = seedTasks();
    await persist(cache);
  }
  return cache;
}

/** Read a snapshot (never the live array). */
export async function read(): Promise<Task[]> {
  return (await load()).map((t) => ({ ...t, labels: [...t.labels] }));
}

/**
 * Mutate under a simple in-process critical section. `mutate` receives the live
 * array and returns whatever the caller needs; changes are persisted after.
 */
let chain: Promise<unknown> = Promise.resolve();

export function transaction<T>(mutate: (tasks: Task[]) => T): Promise<T> {
  const run = async (): Promise<T> => {
    const tasks = await load();
    const result = mutate(tasks);
    await persist(tasks);
    return result;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

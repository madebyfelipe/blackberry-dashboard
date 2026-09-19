import { promises as fs } from "node:fs";
import path from "node:path";
import type { User } from "./types";
import { seedUsers } from "./seed";

/*
 * Mesma estratégia do store de tarefas: arquivo JSON quando o disco aceita
 * escrita (dev), memória quando não (serverless). Trocar por Postgres é um
 * drop-in aqui — ver ROADMAP ("Auth real + multi-tenant").
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");

let cache: User[] | null = null;
let canPersist = true;

async function persist(users: User[]): Promise<void> {
  if (!canPersist) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  } catch {
    canPersist = false;
  }
}

async function load(): Promise<User[]> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as User[];
  } catch {
    cache = seedUsers();
    await persist(cache);
  }
  return cache;
}

export async function read(): Promise<User[]> {
  return (await load()).map((u) => ({ ...u }));
}

let chain: Promise<unknown> = Promise.resolve();

export function transaction<T>(mutate: (users: User[]) => T): Promise<T> {
  const run = async (): Promise<T> => {
    const users = await load();
    const result = mutate(users);
    await persist(users);
    return result;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

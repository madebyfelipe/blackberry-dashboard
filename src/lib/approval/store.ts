import { promises as fs } from "node:fs";
import path from "node:path";
import type { Batch } from "./types";
import { seedBatches } from "./seed";

/* Same storage strategy as tasks/store.ts: JSON file with in-memory fallback. */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "batches.json");

let cache: Batch[] | null = null;
let canPersist = true;

async function persist(batches: Batch[]): Promise<void> {
  if (!canPersist) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(batches, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  } catch {
    canPersist = false;
  }
}

async function load(): Promise<Batch[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Batch[];
  } catch {
    cache = seedBatches();
    await persist(cache);
  }
  return cache;
}

export async function read(): Promise<Batch[]> {
  return structuredClone(await load());
}

let chain: Promise<unknown> = Promise.resolve();

export function transaction<T>(mutate: (batches: Batch[]) => T): Promise<T> {
  const run = async (): Promise<T> => {
    const batches = await load();
    const result = mutate(batches);
    await persist(batches);
    return result;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

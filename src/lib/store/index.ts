import { createJsonStore, type JsonStore } from "./json-file";
import { createPostgresStore } from "./postgres";

/*
 * Porta única dos `store.ts` de área: decide, por `DATABASE_URL`, se os dados
 * vão para o Postgres (issue #11 — Neon pelo marketplace da Vercel) ou para o
 * arquivo local de sempre. Sem a variável — dev sem banco, e todo teste — o
 * comportamento é exatamente o de antes, `createJsonStore` puro.
 */
export function createStore<T>(options: {
  /** Nome do arquivo dentro de `data/` (ex.: "tasks.json"). */
  file: string;
  seed: () => T;
  revive?: (raw: unknown) => T;
}): JsonStore<T> {
  if (process.env.DATABASE_URL) {
    return createPostgresStore<T>({
      key: options.file.replace(/\.json$/, ""),
      seed: options.seed,
      revive: options.revive,
    });
  }
  return createJsonStore(options);
}

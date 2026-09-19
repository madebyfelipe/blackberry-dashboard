import { createJsonStore } from "@/lib/store/json-file";
import type { Batch } from "./types";
import { seedBatches } from "./seed";

/* Mesma mecânica dos outros stores — ver `lib/store/json-file.ts`. */

const store = createJsonStore<Batch[]>({
  file: "batches.json",
  seed: seedBatches,
});

export const read = store.read;
export const transaction = store.transaction;

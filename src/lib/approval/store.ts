import { createJsonStore } from "@/lib/store/json-file";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import type { Batch } from "./types";
import { seedBatches } from "./seed";

/* Mesma mecânica dos outros stores — ver `lib/store/json-file.ts`. */

/**
 * Migração de leitura: lote gravado antes do multi-tenant não tem agência, e a
 * única agência que existia era a semeada. Roda sozinha na primeira leitura do
 * arquivo, como a normalização das tarefas — nenhum lote some, e nenhum lote
 * antigo aparece para uma agência que acabou de se cadastrar.
 */
function normalize(raw: Partial<Batch> & { id: string }): Batch {
  return {
    ...(raw as Batch),
    agencyId: agencyIdOrLegacy(raw.agencyId),
  };
}

const store = createJsonStore<Batch[]>({
  file: "batches.json",
  seed: seedBatches,
  revive: (raw) => (raw as (Partial<Batch> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

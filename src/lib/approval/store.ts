import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import type { Batch } from "./types";
import { seedBatches } from "./seed";

/* Mesma mecânica dos outros stores — backend por `DATABASE_URL` em `lib/store/index.ts`. */

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
    // Lote gravado antes do vínculo com `Client.id` fica sem par — a criação
    // de lote novo é o único caminho de escrita hoje (`createBatch` resolve).
    clientId: raw.clientId ? String(raw.clientId) : null,
  };
}

const store = createStore<Batch[]>({
  file: "batches.json",
  seed: seedBatches,
  revive: (raw) => (raw as (Partial<Batch> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

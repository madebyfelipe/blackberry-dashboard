import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import type { Batch, Piece } from "./types";
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
    pieces: ((raw.pieces as Piece[] | undefined) ?? []).map(backfillSentAt(raw.stage)),
  };
}

/**
 * Migração de leitura (issue #106): `sentAt` não existia antes desta
 * correção, e o link público mostrava toda peça do lote, sem olhar para
 * "enviada" ou não. Lote gravado sem `stage` é de antes até do rascunho
 * existir como conceito — sempre esteve no ar, então toda peça dele herda o
 * envio. Lote que já tinha `stage` só herda quem já tem o histórico de
 * "Enviada para aprovação" (foi mostrada de verdade) ou já foi decidida (só
 * chega lá depois de mostrada) — peça de rascunho continua de fora, que é a
 * própria correção da issue.
 */
function backfillSentAt(stage: Batch["stage"]) {
  return (piece: Piece): Piece => {
    if (piece.sentAt) return piece;
    if (!stage) return { ...piece, sentAt: piece.date };
    const sentEvent = piece.history.find((h) => h.title === "Enviada para aprovação");
    if (sentEvent) return { ...piece, sentAt: sentEvent.at ?? piece.date };
    if (piece.status !== "pendente") return { ...piece, sentAt: piece.date };
    return piece;
  };
}

const store = createStore<Batch[]>({
  file: "batches.json",
  seed: seedBatches,
  revive: (raw) => (raw as (Partial<Batch> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

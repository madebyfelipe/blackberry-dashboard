import { read, transaction } from "./store";
import { isBatchLinkActive } from "./constants";
import type { Batch, DecisionEvent, Piece, PieceStatus } from "./types";

export async function listBatches(): Promise<Batch[]> {
  return read();
}

export async function getBatch(id: string): Promise<Batch | undefined> {
  return (await read()).find((b) => b.id === id);
}

export async function getBatchByToken(token: string): Promise<Batch | undefined> {
  return (await read()).find((b) => b.token === token);
}

function nowStamp(): string {
  const M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} · ${time}`;
}

/** Record a client decision on a piece (used by the public approval link). */
export async function decidePiece(
  token: string,
  pieceId: string,
  decision: PieceStatus,
  opts?: { reason?: string; who?: string; ip?: string },
): Promise<Piece | undefined | "inactive-link"> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.token === token);
    if (!batch) return undefined;
    if (!isBatchLinkActive(batch)) return "inactive-link" as const;
    const piece = batch.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;

    piece.status = decision;
    if (decision === "ajuste" && opts?.reason) piece.reason = opts.reason;

    const who = (opts?.who || "Cliente") + " · " + nowStamp();
    const title =
      decision === "aprovado"
        ? "Aprovada pelo cliente"
        : decision === "ajuste"
          ? "Ajuste pedido pelo cliente"
          : "Marcada como pendente";
    const event: DecisionEvent = {
      id: "h" + Math.random().toString(36).slice(2, 8),
      title,
      who,
      ip: opts?.ip,
      // Exact content the client saw when deciding — protects against later edits.
      snapshot: { caption: piece.caption, kind: piece.kind, size: piece.size },
    };
    piece.history = [event, ...piece.history];
    return { ...piece };
  });
}

/** Generate a fresh public token for a batch, clearing any revocation and extending expiry 30 days out. */
export async function regenerateBatchToken(batchId: string): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return undefined;
    batch.token = randomToken();
    batch.tokenRevoked = false;
    batch.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { ...batch };
  });
}

/** Manually disable (or re-enable) a batch's public link without changing the token. */
export async function setBatchLinkRevoked(
  batchId: string,
  revoked: boolean,
): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return undefined;
    batch.tokenRevoked = revoked;
    return { ...batch };
  });
}

function randomToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 15; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Agency action: mark an "ajuste" piece as redone → back to pendente for re-review. */
export async function markPieceRedone(
  batchId: string,
  pieceId: string,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;
    piece.status = "pendente";
    piece.reason = undefined;
    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: "Marcada como refeita",
        who: "Estúdio Norte · " + nowStamp(),
      },
      ...piece.history,
    ];
    return { ...piece };
  });
}

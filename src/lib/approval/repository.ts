import { read, transaction } from "./store";
import {
  formatFromDimensions,
  isBatchLinkActive,
  PIECE_FORMATS,
  sizeFromDimensions,
} from "./constants";
import { deleteMedia } from "@/lib/media/store";
import type { MediaAsset } from "@/lib/media/types";
import type {
  Batch,
  DecisionEvent,
  Piece,
  PieceDraftPatch,
  PieceStatus,
} from "./types";

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

/* --- Editor de lote (visão agência) --- */

/** Salva o rascunho de uma peça (legenda, hashtags, formato, canal, data). */
export async function updatePieceDraft(
  batchId: string,
  pieceId: string,
  patch: PieceDraftPatch,
): Promise<{ batch: Batch; piece: Piece } | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!batch || !piece) return undefined;

    if (patch.caption !== undefined) piece.caption = patch.caption;
    if (patch.hashtags !== undefined) piece.hashtags = patch.hashtags;
    if (patch.channel !== undefined) piece.channel = patch.channel;
    if (patch.name !== undefined) piece.name = patch.name;
    if (patch.date !== undefined) piece.date = patch.date;
    if (patch.format !== undefined) {
      piece.format = patch.format;
      // O formato manda no tamanho da arte — mantém `size` e `kind` coerentes.
      const meta = PIECE_FORMATS.find((f) => f.id === patch.format);
      if (meta) {
        piece.size = patch.size ?? meta.size;
        piece.kind = meta.label;
      }
    } else if (patch.size !== undefined) {
      piece.size = patch.size;
    }

    batch.draftSavedAt = new Date().toISOString();
    return { batch: { ...batch }, piece: { ...piece } };
  });
}

/**
 * Cria uma peça no fim do lote ("Adicionar peça" no editor).
 *
 * Com `media`, a peça nasce da arte enviada: nome do arquivo, tamanho real e
 * formato deduzido das dimensões — é o caminho do "Subir artes".
 */
export async function addPiece(
  batchId: string,
  media?: MediaAsset,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return undefined;
    const n = batch.pieces.length + 1;
    const format =
      media?.width && media?.height
        ? formatFromDimensions(media.width, media.height, media.kind)
        : "feed";
    const meta = PIECE_FORMATS.find((f) => f.id === format) ?? PIECE_FORMATS[0];
    const piece: Piece = {
      id: "p" + Math.random().toString(36).slice(2, 8),
      name: media ? fileLabel(media.name) : `Peça ${String(n).padStart(2, "0")}`,
      size:
        media?.width && media?.height
          ? sizeFromDimensions(media.width, media.height)
          : meta.size,
      date: new Date().toISOString(),
      status: "pendente",
      kind: meta.label,
      format,
      channel: "instagram",
      caption: "",
      hashtags: "",
      media,
      history: [
        {
          id: "h" + Math.random().toString(36).slice(2, 8),
          title: media ? "Arte enviada para o lote" : "Peça criada no lote",
          who: "Estúdio Norte · " + nowStamp(),
        },
      ],
    };
    batch.pieces.push(piece);
    batch.stage = "rascunho";
    batch.draftSavedAt = new Date().toISOString();
    return { ...piece };
  });
}

/** "capa-lancamento.png" → "Capa lancamento" (nome que o time reconhece). */
function fileLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Nova peça";
  return base.charAt(0).toUpperCase() + base.slice(1).slice(0, 60);
}

/**
 * Troca (ou remove) a arte de uma peça. A arte anterior é apagada do
 * armazenamento — o histórico guarda a decisão, não o arquivo velho.
 */
export async function setPieceMedia(
  batchId: string,
  pieceId: string,
  media: MediaAsset | null,
): Promise<{ batch: Batch; piece: Piece } | undefined> {
  const result = await transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!batch || !piece) return undefined;

    const previous = piece.media;
    piece.media = media ?? undefined;

    if (media?.width && media?.height) {
      piece.size = sizeFromDimensions(media.width, media.height);
      const format = formatFromDimensions(media.width, media.height, media.kind);
      piece.format = format;
      const meta = PIECE_FORMATS.find((f) => f.id === format);
      if (meta) piece.kind = meta.label;
    }

    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: media
          ? previous
            ? "Arte substituída"
            : "Arte enviada"
          : "Arte removida",
        who: "Estúdio Norte · " + nowStamp(),
      },
      ...piece.history,
    ];

    batch.draftSavedAt = new Date().toISOString();
    return {
      batch: { ...batch },
      piece: { ...piece },
      previousMediaId: previous?.id,
    };
  });

  if (!result) return undefined;
  if (result.previousMediaId && result.previousMediaId !== media?.id) {
    await deleteMedia(result.previousMediaId);
  }
  return { batch: result.batch, piece: result.piece };
}

/** Fecha o rascunho: o lote passa a valer para o link público do cliente. */
export async function sendBatchForApproval(
  batchId: string,
): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return undefined;
    batch.stage = "em-aprovacao";
    batch.draftSavedAt = new Date().toISOString();
    const stamp = nowStamp();
    for (const piece of batch.pieces) {
      if (piece.status !== "pendente") continue;
      piece.history = [
        {
          id: "h" + Math.random().toString(36).slice(2, 8),
          title: "Enviada para aprovação",
          who: "Estúdio Norte · " + stamp,
        },
        ...piece.history,
      ];
    }
    return { ...batch };
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

/**
 * Agency action: aprovar a peça pela própria agência ("Aprovar peça" no painel
 * de detalhe do export "Clínica Aurora · Lote"). Fica registrado como decisão
 * da agência — a decisão do cliente continua vindo só pelo link público.
 */
export async function approvePieceByAgency(
  batchId: string,
  pieceId: string,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = batches.find((b) => b.id === batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;
    if (piece.status === "aprovado") return { ...piece };
    piece.status = "aprovado";
    piece.reason = undefined;
    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: "Aprovada pela agência",
        who: "Estúdio Norte · " + nowStamp(),
        snapshot: { caption: piece.caption, kind: piece.kind, size: piece.size },
      },
      ...piece.history,
    ];
    return { ...piece };
  });
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

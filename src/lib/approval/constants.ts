import type {
  Batch,
  Piece,
  PieceChannel,
  PieceFormat,
  PieceStatus,
} from "./types";

export type PieceStatusMeta = {
  id: PieceStatus;
  label: string;
  /** badge background + text, from the Lote export */
  badgeBg: string;
  badgeFg: string;
};

export const PIECE_STATUS: Record<PieceStatus, PieceStatusMeta> = {
  pendente: { id: "pendente", label: "Pendente", badgeBg: "#3a3a3a", badgeFg: "#ffffff" },
  aprovado: { id: "aprovado", label: "Aprovado", badgeBg: "#4b4b4b", badgeFg: "#ffffff" },
  ajuste: { id: "ajuste", label: "Ajuste pedido", badgeBg: "#e8e8e8", badgeFg: "#141414" },
};

/* --- Editor de lote (export "Clínica Aurora - Editor de Lote") --- */

export const PIECE_FORMATS: { id: PieceFormat; label: string; size: string }[] = [
  { id: "feed", label: "Feed", size: "1080 x 1080" },
  { id: "stories", label: "Stories", size: "1080 x 1920" },
  { id: "carrossel", label: "Carrossel", size: "1080 x 1350" },
  { id: "reels", label: "Reels", size: "1080 x 1920" },
];

export const PIECE_CHANNELS: { id: PieceChannel; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
];

/** Limite de caracteres da legenda no Instagram — usado no contador do editor. */
export const CAPTION_LIMIT = 2200;

/**
 * Peças antigas só têm `kind` livre ("Story · sequência de 2"). O editor lê o
 * formato daí enquanto o campo novo não é preenchido.
 */
export function pieceFormat(piece: Piece): PieceFormat {
  if (piece.format) return piece.format;
  const k = piece.kind.toLowerCase();
  if (k.includes("reels")) return "reels";
  if (k.includes("story") || k.includes("stories")) return "stories";
  if (k.includes("carrossel")) return "carrossel";
  return "feed";
}

export function pieceFormatLabel(piece: Piece): string {
  const id = pieceFormat(piece);
  return PIECE_FORMATS.find((f) => f.id === id)?.label ?? "Feed";
}

export function pieceChannel(piece: Piece): PieceChannel {
  return piece.channel ?? "instagram";
}

export function batchStage(batch: Batch) {
  return batch.stage ?? "em-aprovacao";
}

export function batchProgress(batch: Batch) {
  const total = batch.pieces.length;
  const aprovadas = batch.pieces.filter((p) => p.status === "aprovado").length;
  const ajuste = batch.pieces.filter((p) => p.status === "ajuste").length;
  const pendentes = batch.pieces.filter((p) => p.status === "pendente").length;
  const decided = aprovadas + ajuste;
  const pct = total === 0 ? 0 : Math.round((decided / total) * 100);
  return { total, aprovadas, ajuste, pendentes, decided, pct };
}

export function progressCaption(batch: Batch): string {
  const { aprovadas, ajuste, pendentes } = batchProgress(batch);
  return `${aprovadas} aprovadas · ${ajuste} com ajuste pedido · ${pendentes} pendentes`;
}

export type LinkStatus = "ativo" | "revogado" | "expirado";

export function batchLinkStatus(batch: Batch): LinkStatus {
  if (batch.tokenRevoked) return "revogado";
  if (batch.tokenExpiresAt && new Date(batch.tokenExpiresAt).getTime() < Date.now()) {
    return "expirado";
  }
  return "ativo";
}

export function isBatchLinkActive(batch: Batch): boolean {
  return batchLinkStatus(batch) === "ativo";
}

import type { Batch, PieceStatus } from "./types";

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

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
  /** cor do ponto da pílula de status (export "Clínica Aurora · Lote") */
  dot: string;
};

/*
 * As cores são os tokens de `globals.css` — a paleta inteira mora lá, e aqui
 * fica só a régua de status da peça. Todas vão parar em `style`, então o
 * `var()` resolve no elemento.
 */
export const PIECE_STATUS: Record<PieceStatus, PieceStatusMeta> = {
  pendente: {
    id: "pendente",
    label: "Pendente",
    badgeBg: "var(--color-badge)",
    badgeFg: "var(--color-fg)",
    dot: "var(--color-fg-2)",
  },
  aprovado: {
    id: "aprovado",
    label: "Aprovado",
    badgeBg: "var(--color-badge-strong)",
    badgeFg: "var(--color-fg)",
    dot: "var(--color-primary)",
  },
  ajuste: {
    id: "ajuste",
    label: "Ajuste pedido",
    badgeBg: "var(--color-primary)",
    badgeFg: "var(--color-on-primary)",
    // #888888 do export e o #898989 de `muted` são o mesmo cinza na prática
    // (1/255); fica no token de texto em vez de puxar um token de tarefa.
    dot: "var(--color-muted)",
  },
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

/**
 * Formato provável a partir das dimensões da arte enviada — o editor já chega
 * com o chip certo marcado em vez de deixar tudo em "Feed".
 *
 * Quadrado → Feed; retrato 4:5 → Carrossel; vertical alto → Stories (vídeo
 * vertical → Reels). Paisagem cai em Feed, que é o formato que a aceita.
 */
export function formatFromDimensions(
  width: number,
  height: number,
  kind: "image" | "video",
): PieceFormat {
  if (!width || !height) return "feed";
  const ratio = width / height;
  if (ratio > 0.95 && ratio < 1.05) return "feed";
  if (ratio < 0.62) return kind === "video" ? "reels" : "stories";
  if (ratio < 0.95) return "carrossel";
  return "feed";
}

/** Tamanho legível ("1080 x 1350") a partir das dimensões lidas do arquivo. */
export function sizeFromDimensions(width: number, height: number): string {
  return `${width} x ${height}`;
}

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

/**
 * Mensagem pronta para mandar o link ao cliente (WhatsApp, e-mail ou colada
 * onde for). Fica aqui, e não na view, para os três canais dizerem a mesma
 * coisa — ROADMAP: "Envio do link por WhatsApp/e-mail".
 */
export function shareMessage(batch: Batch, url: string): string {
  const { total } = batchProgress(batch);
  const pecas = total === 1 ? "1 peça" : `${total} peças`;
  return (
    `Oi! O lote "${batch.label}" está pronto para sua aprovação — ${pecas} para revisar.\n\n` +
    `É só abrir o link, deslizar e aprovar (ou pedir ajuste, com o motivo):\n${url}\n\n` +
    `Qualquer dúvida, é só responder por aqui.`
  );
}

/** Assunto do e-mail com o link de aprovação. */
export function shareSubject(batch: Batch): string {
  return `${batch.client} · ${batch.label} — aprovação de conteúdo`;
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

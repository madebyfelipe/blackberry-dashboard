import type { MediaAsset } from "@/lib/media/types";
import type { Batch, Piece, PieceStatus } from "./types";

/*
 * O que atravessa o link público (`/a/<token>`) — nos dois sentidos. É a
 * única porta sem login do produto, e o link circula por WhatsApp (issue
 * #77): o que sai daqui para a tela do cliente é só o que ela mostra, e o
 * que entra tem teto.
 *
 * Puro de propósito (sem store, sem `node:*`): a tela do cliente importa os
 * tetos, e `tests/approval-public.test.ts` confere a régua.
 */

/** Teto do motivo do ajuste — o que o cliente digita. */
export const PUBLIC_REASON_MAX = 1000;
/** Teto do "quem" que o navegador manda (hoje, sempre "Cliente"). */
export const PUBLIC_WHO_MAX = 80;
/** Corpo inteiro da requisição: cabe o motivo no teto, escapado, com folga. */
export const PUBLIC_BODY_MAX = 16 * 1024;
/**
 * Eventos guardados por peça. Cada decisão empilha um — com a foto da
 * legenda que o cliente viu —, e os lotes de todas as agências moram numa
 * linha só: sem teto, repetir o POST inchava a leitura de todo mundo.
 */
export const PIECE_HISTORY_MAX = 100;
/** Decisões por token + IP numa janela do freio (ver a rota). */
export const PUBLIC_WRITES_MAX = 100;
export const PUBLIC_WRITES_WINDOW_MS = 10 * 60_000;

const DECISIONS: PieceStatus[] = ["aprovado", "ajuste", "pendente"];

export type PublicDecision = {
  pieceId: string;
  decision: PieceStatus;
  reason?: string;
  who?: string;
};

/**
 * Lê o corpo cru do POST do cliente. Recusa antes de gravar: corpo acima do
 * teto (413), JSON quebrado (400) e campo fora da régua (422).
 */
export function parsePublicDecision(
  raw: string,
): { ok: true; value: PublicDecision } | { ok: false; status: number; error: string } {
  if (raw.length > PUBLIC_BODY_MAX) {
    return { ok: false, status: 413, error: "Pedido grande demais." };
  }
  let body: Record<string, unknown>;
  try {
    body = (JSON.parse(raw) ?? {}) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "JSON inválido." };
  }
  if (typeof body !== "object") return { ok: false, status: 400, error: "JSON inválido." };

  const pieceId = String(body.pieceId ?? "");
  const decision = String(body.decision ?? "") as PieceStatus;
  const reason = body.reason ? String(body.reason) : undefined;
  const who = body.who ? String(body.who) : undefined;

  if (!pieceId || !DECISIONS.includes(decision)) {
    return { ok: false, status: 422, error: "Decisão inválida." };
  }
  if (decision === "ajuste" && !reason?.trim()) {
    return { ok: false, status: 422, error: "A reprovação exige um motivo." };
  }
  if (reason && reason.length > PUBLIC_REASON_MAX) {
    return { ok: false, status: 422, error: `O motivo passa de ${PUBLIC_REASON_MAX} caracteres.` };
  }
  if (who && who.length > PUBLIC_WHO_MAX) {
    return { ok: false, status: 422, error: "Nome longo demais." };
  }
  return { ok: true, value: { pieceId, decision, reason, who } };
}

/** A arte como a tela do cliente precisa: sem o endereço no Blob nem dono. */
export type PublicMedia = Pick<MediaAsset, "id" | "url" | "kind" | "name" | "width" | "height">;

export type PublicPiece = Pick<
  Piece,
  "id" | "name" | "size" | "date" | "status" | "kind" | "caption" | "hashtags" | "format" | "channel" | "reason"
> & { media?: PublicMedia[] };

/**
 * O lote do link público. Fica de fora tudo que é da agência: agência e
 * cliente internos (`agencyId`, `clientId`), briefing do lote e da peça,
 * histórico (com o IP de quem decidiu antes) e o pathname das artes.
 */
export type PublicBatch = Pick<Batch, "token" | "client" | "label"> & {
  pieces: PublicPiece[];
};

export function toPublicMedia(m: MediaAsset): PublicMedia {
  return { id: m.id, url: m.url, kind: m.kind, name: m.name, width: m.width, height: m.height };
}

export function toPublicPiece(p: Piece): PublicPiece {
  return {
    id: p.id,
    name: p.name,
    size: p.size,
    date: p.date,
    status: p.status,
    kind: p.kind,
    caption: p.caption,
    hashtags: p.hashtags,
    format: p.format,
    channel: p.channel,
    reason: p.reason,
    media: p.media?.map(toPublicMedia),
  };
}

export function toPublicBatch(b: Batch): PublicBatch {
  return {
    token: b.token,
    client: b.client,
    label: b.label,
    // Só peça já enviada (`sentAt`) — rascunho não é do cliente (issue #106).
    pieces: b.pieces.filter((p) => p.sentAt).map(toPublicPiece),
  };
}

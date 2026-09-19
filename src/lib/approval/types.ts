import type { MediaAsset } from "@/lib/media/types";

export type PieceStatus = "pendente" | "aprovado" | "ajuste";

export type DecisionEvent = {
  id: string;
  /** e.g. "Ajuste pedido pelo cliente" */
  title: string;
  /** e.g. "Marina Duarte · 11 set · 21:14" */
  who: string;
  /** client IP at the moment of decision (public link only) */
  ip?: string;
  /** exact content shown to the client when they decided */
  snapshot?: { caption?: string; kind: string; size: string };
};

/** Formatos do editor de lote (chips FORMATO do export "Editor de Lote"). */
export type PieceFormat = "feed" | "stories" | "carrossel" | "reels";

/** Canais do editor de lote (chips CANAL do mesmo export). */
export type PieceChannel = "instagram" | "tiktok" | "facebook";

export type Piece = {
  id: string;
  name: string;
  /** e.g. "1080 x 1080" */
  size: string;
  /** ISO date */
  date: string;
  status: PieceStatus;
  /** e.g. "Story · sequência de 2" */
  kind: string;
  caption?: string;
  /** hashtags sem "#", separadas por espaço */
  hashtags?: string;
  format?: PieceFormat;
  channel?: PieceChannel;
  /** Arte enviada pela agência. Sem ela, a peça cai no placeholder. */
  media?: MediaAsset;
  /** reason given on "ajuste" / reprovação */
  reason?: string;
  history: DecisionEvent[];
};

/** Campos editáveis pela agência no editor de lote. */
export type PieceDraftPatch = Partial<
  Pick<Piece, "caption" | "hashtags" | "format" | "channel" | "date" | "size" | "name">
>;

/** Ciclo do lote: em edição na agência ou já enviado ao cliente. */
export type BatchStage = "rascunho" | "em-aprovacao";

export type Batch = {
  id: string;
  client: string;
  /** e.g. "Lote setembro · 01-30 set" */
  label: string;
  stage?: BatchStage;
  /** ISO — última gravação do rascunho no editor */
  draftSavedAt?: string;
  /** @ do cliente usado no preview do post (ex.: "clinica.aurora") */
  handle?: string;
  /** public share token */
  token: string;
  /** ISO date after which the public link stops accepting decisions */
  tokenExpiresAt?: string | null;
  /** manually disabled by the agency, independent of expiry */
  tokenRevoked?: boolean;
  pieces: Piece[];
};

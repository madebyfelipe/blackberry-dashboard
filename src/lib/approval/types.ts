import type { AgencyId } from "@/lib/agency/types";
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
  /**
   * O que o designer precisa saber para produzir a peça. É interno da
   * agência: vai para a tarefa do criativo, nunca para o link do cliente.
   */
  briefing?: string;
  format?: PieceFormat;
  channel?: PieceChannel;
  /**
   * Artes enviadas pela agência, na ordem do carrossel. Sem nenhuma, a peça
   * cai no placeholder; com mais de uma, é carrossel.
   */
  media?: MediaAsset[];
  /** reason given on "ajuste" / reprovação */
  reason?: string;
  history: DecisionEvent[];
};

/** Campos editáveis pela agência no editor de lote. */
export type PieceDraftPatch = Partial<
  Pick<Piece, "caption" | "hashtags" | "briefing" | "format" | "channel" | "date" | "size" | "name">
>;

/** Ciclo do lote: em edição na agência ou já enviado ao cliente. */
export type BatchStage = "rascunho" | "em-aprovacao";

export type Batch = {
  id: string;
  /**
   * Agência dona do lote. Toda operação da agência confere este campo contra a
   * sessão; o link público do cliente é a exceção, e quem autoriza lá é o
   * token (ver `repository.ts`).
   */
  agencyId: AgencyId;
  client: string;
  /**
   * O `Client.id` cujo nome bate com `client`, resolvido na criação do lote
   * (`resolveClientId`, em `lib/clients/repository.ts`). `null` quando não
   * bate com nenhum cliente cadastrado — o lote continua existindo, só sem
   * o vínculo (ver "Cliente ainda é texto livre" no ROADMAP).
   */
  clientId: string | null;
  /** e.g. "Lote setembro · 01-30 set" */
  label: string;
  /** Briefing curto que a agência escreve ao criar o lote. */
  description?: string;
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

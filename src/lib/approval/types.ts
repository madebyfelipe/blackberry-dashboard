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
  /** reason given on "ajuste" / reprovação */
  reason?: string;
  history: DecisionEvent[];
};

export type Batch = {
  id: string;
  client: string;
  /** e.g. "Lote setembro · 01-30 set" */
  label: string;
  /** public share token */
  token: string;
  /** ISO date after which the public link stops accepting decisions */
  tokenExpiresAt?: string | null;
  /** manually disabled by the agency, independent of expiry */
  tokenRevoked?: boolean;
  pieces: Piece[];
};

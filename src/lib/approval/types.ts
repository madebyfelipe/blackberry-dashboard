export type PieceStatus = "pendente" | "aprovado" | "ajuste";

export type DecisionEvent = {
  id: string;
  /** e.g. "Ajuste pedido pelo cliente" */
  title: string;
  /** e.g. "Marina Duarte · 11 set · 21:14" */
  who: string;
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
  pieces: Piece[];
};

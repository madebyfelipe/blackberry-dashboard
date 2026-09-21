export type MediaKind = "image" | "video";

/** Arte enviada pela agência e anexada a uma peça do lote. */
export type MediaAsset = {
  id: string;
  /** URL servida pelo próprio app (`/api/media/<id>`). */
  url: string;
  kind: MediaKind;
  mime: string;
  /** Nome do arquivo original, como o time reconhece. */
  name: string;
  /** Bytes. */
  size: number;
  /** Dimensões, quando dá para ler do cabeçalho do arquivo. */
  width?: number;
  height?: number;
  createdAt: string;
  /** URL pública no Vercel Blob, quando `BLOB_READ_WRITE_TOKEN` está configurado. */
  blobUrl?: string;
};

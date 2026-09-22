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
  /** URL do objeto no Vercel Blob, quando `BLOB_READ_WRITE_TOKEN` está configurado. */
  blobUrl?: string;
  /**
   * Pathname do objeto dentro do store (`media/<algo>.<ext>`). O store é
   * privado (issue #39): é a partir daqui que se assina a URL de download de
   * curta duração — a `blobUrl` sozinha não abre mais o arquivo.
   */
  blobPathname?: string;
};

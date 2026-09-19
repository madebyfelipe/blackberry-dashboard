import type { MediaKind } from "./types";

/*
 * Constantes do upload — separadas do `store.ts` de propósito: o store fala
 * com o disco (node:fs) e não pode ser importado por componente de cliente.
 * A dropzone precisa destes valores no navegador.
 */

/** O que o app aceita — a dropzone anuncia PNG, JPG e MP4. */
export const ACCEPTED_MIME: Record<string, { ext: string; kind: MediaKind }> = {
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
};

/** Valor do atributo `accept` do <input type="file">. */
export const ACCEPT_ATTR = Object.keys(ACCEPTED_MIME).join(",");

/** 50 MB — o mesmo limite que a dropzone promete ao usuário. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** "2,4 MB" — tamanho legível do arquivo. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

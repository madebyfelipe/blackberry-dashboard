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

/*
 * Upload direto para o Vercel Blob.
 *
 * O corpo de uma requisição na Vercel é cortado em 4,5 MB **antes** de a
 * função rodar (`413`, `source: "static"` no log) — em qualquer plano. Como a
 * dropzone promete 50 MB, arte de verdade não caberia passando pela rota.
 * Então o navegador manda o arquivo direto para o Blob e o app só registra o
 * que chegou; ver `saveBlobMedia` em `media/store.ts`.
 */

/** Pasta das artes dentro do store. O prefixo é o que o servidor valida. */
export const BLOB_MEDIA_PREFIX = "media/";

/** Acima disso o SDK fatia o upload em partes paralelas, com retry por parte. */
export const BLOB_MULTIPART_THRESHOLD = 8 * 1024 * 1024;

/**
 * Pathname pedido pelo navegador: `media/<nome-limpo>.<ext>`.
 *
 * O nome é só para o store ficar legível — quem garante unicidade é o
 * `addRandomSuffix` que o servidor impõe ao emitir o token, e o id da arte
 * (esse sim aleatório) nasce no servidor, no registro.
 */
export function blobPathnameFor(name: string, mime: string): string {
  const { ext } = ACCEPTED_MIME[mime] ?? { ext: "bin" };
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${BLOB_MEDIA_PREFIX}${base || "arte"}.${ext}`;
}

/** O servidor só aceita registrar (e só emite token para) este formato. */
export function isMediaBlobPathname(pathname: string): boolean {
  if (!pathname.startsWith(BLOB_MEDIA_PREFIX)) return false;
  const rest = pathname.slice(BLOB_MEDIA_PREFIX.length);
  // Uma pasta só, sem subir nível e sem nome escondido. O sufixo aleatório
  // que o Blob acrescenta ao pathname pode trazer maiúscula.
  return /^[A-Za-z0-9][A-Za-z0-9-]*\.[a-z0-9]{2,4}$/.test(rest);
}

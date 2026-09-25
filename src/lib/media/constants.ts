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

/**
 * Os anexos da conversa do Inbox: as artes de sempre, mais áudio (o gravado
 * no próprio campo é `audio/webm` ou `audio/mp4`, conforme o navegador) e os
 * documentos do dia a dia de agência. **Nada que o navegador execute** —
 * HTML, SVG, JS ficam de fora, porque o arquivo é servido pelo próprio app.
 */
export const ATTACHMENT_MIME: Record<string, { ext: string; kind: MediaKind }> = {
  ...ACCEPTED_MIME,
  "video/webm": { ext: "webm", kind: "video" },
  "audio/webm": { ext: "weba", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/x-m4a": { ext: "m4a", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "application/pdf": { ext: "pdf", kind: "file" },
  "application/zip": { ext: "zip", kind: "file" },
  "application/x-zip-compressed": { ext: "zip", kind: "file" },
  "text/plain": { ext: "txt", kind: "file" },
  "text/csv": { ext: "csv", kind: "file" },
  "application/msword": { ext: "doc", kind: "file" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", kind: "file" },
  "application/vnd.ms-excel": { ext: "xls", kind: "file" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", kind: "file" },
  "application/vnd.ms-powerpoint": { ext: "ppt", kind: "file" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", kind: "file" },
};

/** 20 MB — o teto de um anexo na conversa. */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

/** Pasta dos anexos dentro do store do Blob (as artes ficam em `media/`). */
export const BLOB_ATTACHMENT_PREFIX = "anexos/";

/**
 * O tipo como o navegador manda, sem parâmetros: o gravador diz
 * `audio/webm;codecs=opus`, e o que importa é `audio/webm`.
 */
export function baseMime(mime: string): string {
  return String(mime ?? "").split(";")[0].trim().toLowerCase();
}

/** Todo tipo que o app sabe guardar — é daqui que o store tira a extensão. */
export const ALL_MIME: Record<string, { ext: string; kind: MediaKind }> = {
  ...ATTACHMENT_MIME,
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
export function blobPathnameFor(
  name: string,
  mime: string,
  prefix: string = BLOB_MEDIA_PREFIX,
): string {
  const { ext } = ALL_MIME[baseMime(mime)] ?? { ext: "bin" };
  const base = name
    .replace(/\.[^.]*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${prefix}${base || "arte"}.${ext}`;
}

/** O servidor só aceita registrar (e só emite token para) este formato. */
export function isMediaBlobPathname(
  pathname: string,
  prefix: string = BLOB_MEDIA_PREFIX,
): boolean {
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  // Uma pasta só, sem subir nível e sem nome escondido. O sufixo aleatório
  // que o Blob acrescenta ao pathname pode trazer maiúscula.
  return /^[A-Za-z0-9][A-Za-z0-9-]*\.[a-z0-9]{2,4}$/.test(rest);
}

/**
 * O que cada porta de upload aceita. As artes do lote e os anexos do Inbox
 * passam pelo mesmo armazenamento (`media/store.ts`); o que muda é a lista
 * de tipos, o teto e a pasta no Blob.
 */
export type MediaPolicy = {
  accepted: Record<string, { ext: string; kind: MediaKind }>;
  maxBytes: number;
  prefix: string;
  notAccepted: string;
  tooBig: string;
};

export const ART_POLICY: MediaPolicy = {
  accepted: ACCEPTED_MIME,
  maxBytes: MAX_UPLOAD_BYTES,
  prefix: BLOB_MEDIA_PREFIX,
  notAccepted: "Formato não aceito. Envie PNG, JPG, WebP, GIF, MP4 ou MOV.",
  tooBig: "Arquivo acima de 50 MB.",
};

export const ATTACHMENT_POLICY: MediaPolicy = {
  accepted: ATTACHMENT_MIME,
  maxBytes: ATTACHMENT_MAX_BYTES,
  prefix: BLOB_ATTACHMENT_PREFIX,
  notAccepted:
    "Esse tipo de arquivo não vai na conversa. Mande imagem, vídeo, áudio, PDF, documento, planilha, apresentação, texto ou ZIP.",
  tooBig: "Anexo acima de 20 MB.",
};

/** Pasta dos arquivos da ficha do cliente dentro do store do Blob. */
export const BLOB_CLIENT_FILE_PREFIX = "clientes/";

/**
 * Os arquivos da ficha do cliente (aba Arquivos): os mesmos tipos do anexo
 * da conversa — nada que o navegador execute — com o teto das artes, porque
 * é aqui que mora o vídeo bruto do cliente.
 */
export const CLIENT_FILE_POLICY: MediaPolicy = {
  accepted: ATTACHMENT_MIME,
  maxBytes: MAX_UPLOAD_BYTES,
  prefix: BLOB_CLIENT_FILE_PREFIX,
  notAccepted:
    "Esse tipo de arquivo não entra na ficha. Envie imagem, vídeo, áudio, PDF, documento, planilha, apresentação, texto ou ZIP.",
  tooBig: "Arquivo acima de 50 MB.",
};

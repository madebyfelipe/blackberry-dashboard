import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { createStore } from "@/lib/store";
import { readDimensions } from "./dimensions";
import {
  ACCEPTED_MIME,
  MAX_UPLOAD_BYTES,
  isMediaBlobPathname,
} from "./constants";
import type { MediaAsset } from "./types";

/*
 * Armazenamento das artes.
 *
 * Os metadados vão para `media.json` (ou a linha "media" do Postgres, ver
 * `lib/store/index.ts`) e os bytes para o Vercel Blob quando existe
 * `BLOB_READ_WRITE_TOKEN` (issue #11) — sem a variável, continuam em
 * `data/uploads/<id>.<ext>`, com fallback em memória para disco
 * somente-leitura (serverless sem Blob configurado).
 */

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export class MediaError extends Error {}

const index = createStore<Record<string, MediaAsset>>({
  file: "media.json",
  seed: () => ({}),
});

/** Reserva para disco somente-leitura. */
const memoryBytes = new Map<string, Uint8Array>();

function fileFor(asset: MediaAsset): string {
  const { ext } = ACCEPTED_MIME[asset.mime] ?? { ext: "bin" };
  return path.join(UPLOAD_DIR, `${asset.id}.${ext}`);
}

function blobPathFor(asset: Pick<MediaAsset, "id" | "mime">): string {
  const { ext } = ACCEPTED_MIME[asset.mime] ?? { ext: "bin" };
  return `media/${asset.id}.${ext}`;
}

/** Grava no Vercel Blob e devolve a URL pública, ou `undefined` sem o token. */
async function putBlob(
  asset: Pick<MediaAsset, "id" | "mime">,
  bytes: Uint8Array,
): Promise<string | undefined> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;
  const { put } = await import("@vercel/blob");
  const blob = await put(blobPathFor(asset), Buffer.from(bytes), {
    access: "public",
    contentType: asset.mime,
    addRandomSuffix: false,
  });
  return blob.url;
}

async function deleteBlob(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const { del } = await import("@vercel/blob");
  await del(url);
}

/**
 * Grava uma arte e devolve o registro.
 *
 * O id é aleatório e longo porque a URL da mídia é servida sem sessão — é o
 * link público de aprovação que precisa carregar as imagens do cliente.
 */
export async function saveMedia(
  bytes: Uint8Array,
  meta: { mime: string; name: string },
): Promise<MediaAsset> {
  const accepted = ACCEPTED_MIME[meta.mime];
  if (!accepted) {
    throw new MediaError(
      "Formato não aceito. Envie PNG, JPG, WebP, GIF, MP4 ou MOV.",
    );
  }
  if (bytes.byteLength === 0) throw new MediaError("Arquivo vazio.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new MediaError("Arquivo acima de 50 MB.");
  }

  const id = randomBytes(16).toString("hex");
  const dims = accepted.kind === "image" ? readDimensions(bytes) : undefined;
  const asset: MediaAsset = {
    id,
    url: `/api/media/${id}`,
    kind: accepted.kind,
    mime: meta.mime,
    name: meta.name || `arte.${accepted.ext}`,
    size: bytes.byteLength,
    width: dims?.width,
    height: dims?.height,
    createdAt: new Date().toISOString(),
  };

  // Bytes primeiro: um registro sem arquivo daria uma arte quebrada na tela.
  const blobUrl = await putBlob(asset, bytes);
  if (blobUrl) {
    asset.blobUrl = blobUrl;
  } else {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.writeFile(fileFor(asset), bytes);
    } catch {
      memoryBytes.set(id, bytes);
    }
  }
  await index.transaction((map) => {
    map[id] = asset;
  });

  return asset;
}

export async function getMedia(id: string): Promise<MediaAsset | undefined> {
  return (await index.read())[id];
}

/** Bytes da arte, do Blob, do disco ou da memória. */
export async function readMedia(
  id: string,
): Promise<{ asset: MediaAsset; bytes: Uint8Array } | undefined> {
  const asset = await getMedia(id);
  if (!asset) return undefined;
  if (asset.blobUrl) {
    const res = await fetch(asset.blobUrl);
    if (!res.ok) return undefined;
    return { asset, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  const cached = memoryBytes.get(id);
  if (cached) return { asset, bytes: cached };
  try {
    const bytes = await fs.readFile(fileFor(asset));
    return { asset, bytes: new Uint8Array(bytes) };
  } catch {
    return undefined;
  }
}

/** Apaga arte e registro. Silencioso se já não existir. */
export async function deleteMedia(id: string): Promise<void> {
  const asset = await getMedia(id);
  if (!asset) return;
  await index.transaction((map) => {
    delete map[id];
  });
  if (asset.blobUrl) {
    await deleteBlob(asset.blobUrl);
    return;
  }
  memoryBytes.delete(id);
  try {
    await fs.unlink(fileFor(asset));
  } catch {
    // Arquivo já não estava lá — o registro sumindo basta.
  }
}

/** Quanto do arquivo basta ler para achar as dimensões no cabeçalho. */
const HEADER_BYTES = 256 * 1024;

/** Na Vercel o Blob fica na mesma região; isto é folga, não expectativa. */
const HEADER_TIMEOUT_MS = 3000;

/**
 * Cabeçalho da arte, por Range — o suficiente para `readDimensions` sem
 * baixar um vídeo de 50 MB dentro da função. Se o Blob ignorar o Range, o
 * `slice` corta o que veio.
 *
 * Dimensão é enfeite: serve para o editor já mostrar "1080 x 1350" e chutar o
 * formato da peça. Então isto nunca segura o upload — com timeout curto e
 * qualquer falha engolida, a arte só fica sem dimensão, do mesmo jeito que um
 * formato que o leitor não reconhece.
 */
async function readBlobHeader(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url, {
      headers: { range: `bytes=0-${HEADER_BYTES - 1}` },
      signal: AbortSignal.timeout(HEADER_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf.byteLength > HEADER_BYTES ? buf.slice(0, HEADER_BYTES) : buf);
  } catch {
    return undefined;
  }
}

/**
 * Registra uma arte que o navegador já subiu direto para o Blob.
 *
 * O contrato é: nada que o cliente manda entra no registro sem passar pelo
 * `head()`. Do navegador vem só o `pathname` (validado no formato) e o nome
 * original do arquivo; **tamanho, tipo e URL vêm do Blob**. É isso que impede
 * registrar uma URL externa como arte — `readMedia` faz `fetch` na `blobUrl`,
 * então aceitar URL do cliente seria abrir um SSRF.
 *
 * O id continua nascendo aqui, aleatório e longo, porque é ele que protege
 * `/api/media/<id>` — servido sem sessão para o link de aprovação.
 */
export async function saveBlobMedia(meta: {
  pathname: string;
  name: string;
}): Promise<MediaAsset> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new MediaError("Envio direto indisponível: o Blob não está configurado.");
  }
  if (!isMediaBlobPathname(meta.pathname)) {
    throw new MediaError("Envio inválido.");
  }

  const { head } = await import("@vercel/blob");
  let found: Awaited<ReturnType<typeof head>>;
  try {
    found = await head(meta.pathname);
  } catch {
    throw new MediaError("Arte não chegou ao armazenamento. Tente enviar de novo.");
  }

  const accepted = ACCEPTED_MIME[found.contentType];
  if (!accepted) {
    throw new MediaError(
      "Formato não aceito. Envie PNG, JPG, WebP, GIF, MP4 ou MOV.",
    );
  }
  if (found.size === 0) throw new MediaError("Arquivo vazio.");
  if (found.size > MAX_UPLOAD_BYTES) throw new MediaError("Arquivo acima de 50 MB.");

  const id = randomBytes(16).toString("hex");
  const header = accepted.kind === "image" ? await readBlobHeader(found.url) : undefined;
  const dims = header ? readDimensions(header) : undefined;
  const asset: MediaAsset = {
    id,
    url: `/api/media/${id}`,
    kind: accepted.kind,
    mime: found.contentType,
    name: meta.name || `arte.${accepted.ext}`,
    size: found.size,
    width: dims?.width,
    height: dims?.height,
    createdAt: new Date().toISOString(),
    blobUrl: found.url,
  };

  await index.transaction((map) => {
    map[id] = asset;
  });

  return asset;
}

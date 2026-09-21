import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { createStore } from "@/lib/store";
import { readDimensions } from "./dimensions";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "./constants";
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

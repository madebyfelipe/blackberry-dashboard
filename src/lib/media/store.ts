import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { readDimensions } from "./dimensions";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "./constants";
import type { MediaAsset } from "./types";

/*
 * Armazenamento das artes.
 *
 * Mesma estratégia dos outros stores: disco quando dá (dev), memória quando
 * não (serverless/somente-leitura). Os bytes vão para `data/uploads/<id>` e os
 * metadados para `data/media.json` — separados de propósito: trocar por um
 * bucket (S3/Blob) mexe só no par `writeBytes`/`readBytes`.
 *
 * Ver ROADMAP: "Upload real de mídia" e a troca do JSON por banco.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const INDEX_FILE = path.join(DATA_DIR, "media.json");

export class MediaError extends Error {}

let index: Record<string, MediaAsset> | null = null;
let canPersist = true;
/** Fallback quando o disco é somente-leitura: bytes vivem no processo. */
const memoryBytes = new Map<string, Uint8Array>();

async function loadIndex(): Promise<Record<string, MediaAsset>> {
  if (index) return index;
  try {
    index = JSON.parse(await fs.readFile(INDEX_FILE, "utf8")) as Record<
      string,
      MediaAsset
    >;
  } catch {
    index = {};
  }
  return index;
}

async function persistIndex(): Promise<void> {
  if (!canPersist || !index) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = INDEX_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(index, null, 2), "utf8");
    await fs.rename(tmp, INDEX_FILE);
  } catch {
    canPersist = false;
  }
}

function fileFor(asset: MediaAsset): string {
  const { ext } = ACCEPTED_MIME[asset.mime] ?? { ext: "bin" };
  return path.join(UPLOAD_DIR, `${asset.id}.${ext}`);
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

  const map = await loadIndex();
  map[id] = asset;

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(fileFor(asset), bytes);
  } catch {
    canPersist = false;
    memoryBytes.set(id, bytes);
  }
  await persistIndex();

  return asset;
}

export async function getMedia(id: string): Promise<MediaAsset | undefined> {
  return (await loadIndex())[id];
}

/** Bytes da arte, do disco ou da memória. */
export async function readMedia(
  id: string,
): Promise<{ asset: MediaAsset; bytes: Uint8Array } | undefined> {
  const asset = await getMedia(id);
  if (!asset) return undefined;
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
  const map = await loadIndex();
  const asset = map[id];
  if (!asset) return;
  delete map[id];
  memoryBytes.delete(id);
  try {
    await fs.unlink(fileFor(asset));
  } catch {
    // Arquivo já não estava lá — o registro sumindo basta.
  }
  await persistIndex();
}

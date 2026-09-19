import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { createJsonStore } from "@/lib/store/json-file";
import { readDimensions } from "./dimensions";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "./constants";
import type { MediaAsset } from "./types";

/*
 * Armazenamento das artes.
 *
 * Os bytes vão para `data/uploads/<id>.<ext>` e os metadados para
 * `data/media.json` pelo store compartilhado (`lib/store/json-file`), que
 * revalida pelo mtime — sem isso, o worker que serve `/api/media/<id>` não
 * enxergaria o que outro worker acabou de gravar.
 *
 * Disco somente-leitura (serverless): os bytes ficam na memória do processo,
 * o que só sustenta a sessão atual. Trocar por um bucket (S3/Blob) mexe nas
 * três funções de byte daqui — ver ROADMAP.
 */

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export class MediaError extends Error {}

const index = createJsonStore<Record<string, MediaAsset>>({
  file: "media.json",
  seed: () => ({}),
});

/** Reserva para disco somente-leitura. */
const memoryBytes = new Map<string, Uint8Array>();

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

  // Bytes primeiro: um registro sem arquivo daria uma arte quebrada na tela.
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(fileFor(asset), bytes);
  } catch {
    memoryBytes.set(id, bytes);
  }
  await index.transaction((map) => {
    map[id] = asset;
  });

  return asset;
}

export async function getMedia(id: string): Promise<MediaAsset | undefined> {
  return (await index.read())[id];
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
  const asset = await getMedia(id);
  if (!asset) return;
  await index.transaction((map) => {
    delete map[id];
  });
  memoryBytes.delete(id);
  try {
    await fs.unlink(fileFor(asset));
  } catch {
    // Arquivo já não estava lá — o registro sumindo basta.
  }
}

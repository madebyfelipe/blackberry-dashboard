import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { createStore } from "@/lib/store";
import { readDimensions } from "./dimensions";
import {
  ALL_MIME,
  ART_POLICY,
  baseMime,
  isMediaBlobPathname,
  type MediaPolicy,
  BLOB_ACCESS,
  BLOB_STORE_NOT_PRIVATE,
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

/** O índice de mídias, para manutenção (ver `lib/maintenance/migrate-blob-private.ts`). */
export const readMediaIndex = index.read;
export const transactionMediaIndex = index.transaction;

/** Reserva para disco somente-leitura. */
const memoryBytes = new Map<string, Uint8Array>();

function fileFor(asset: MediaAsset): string {
  const { ext } = ALL_MIME[asset.mime] ?? { ext: "bin" };
  return path.join(UPLOAD_DIR, `${asset.id}.${ext}`);
}

function blobPathFor(asset: Pick<MediaAsset, "id" | "mime">): string {
  const { ext } = ALL_MIME[asset.mime] ?? { ext: "bin" };
  return `media/${asset.id}.${ext}`;
}

/** Grava no Vercel Blob (privado) e devolve URL e pathname, ou `undefined` sem o token. */
async function putBlob(
  asset: Pick<MediaAsset, "id" | "mime">,
  bytes: Uint8Array,
): Promise<{ url: string; pathname: string } | undefined> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;
  const { put, BlobError } = await import("@vercel/blob");
  try {
    const blob = await put(blobPathFor(asset), Buffer.from(bytes), {
      access: BLOB_ACCESS,
      contentType: asset.mime,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  } catch (err) {
    // Acesso não pode ser trocado num store existente (issue #39): a
    // plataforma exige um store criado como privado. Mensagem clara em vez
    // de 500 cru, até o store trocar.
    if (err instanceof BlobError && /private access on a public store/i.test(err.message)) {
      throw new MediaError(BLOB_STORE_NOT_PRIVATE);
    }
    throw err;
  }
}

async function deleteBlob(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  const { del } = await import("@vercel/blob");
  await del(url);
}

/**
 * URL de download de curta duração para um objeto privado do Blob.
 *
 * Substitui o antigo redirect para a `blobUrl` pública (issue #39): o store
 * não serve mais nada sem assinatura, então quem quer os bytes — o link
 * público do cliente, sem sessão — precisa desta URL, que expira sozinha.
 * `issueSignedToken` + `presignUrl` não fazem chamada de rede: a assinatura é
 * HMAC local com o token do servidor, então isto é barato de chamar por
 * requisição.
 */
export async function presignMediaUrl(pathname: string): Promise<string> {
  const { issueSignedToken, presignUrl } = await import("@vercel/blob");
  const validUntil = Date.now() + 5 * 60 * 1000; // 5 minutos bastam para o navegador buscar a arte.
  const signed = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signed, {
    operation: "get",
    pathname,
    access: "private",
  });
  return presignedUrl;
}

/** Bytes de um objeto privado do Blob, opcionalmente por `Range`. */
async function fetchBlobBytes(
  pathname: string,
  headers?: HeadersInit,
): Promise<Uint8Array | undefined> {
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, { access: "private", headers });
  if (!result || result.statusCode !== 200) return undefined;
  const buf = await new Response(result.stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Duração e forma de onda de um áudio, medidas no navegador e já limpas por
 * `voiceMeta` — só entram no registro quando o arquivo é áudio mesmo.
 */
type AudioMeta = Pick<MediaAsset, "duration" | "waveform">;

/**
 * Grava uma arte e devolve o registro.
 *
 * O id é aleatório e longo porque a URL da mídia é servida sem sessão — é o
 * link público de aprovação que precisa carregar as imagens do cliente.
 */
export async function saveMedia(
  bytes: Uint8Array,
  meta: { mime: string; name: string; owner?: MediaAsset["owner"]; audio?: AudioMeta },
  policy: MediaPolicy = ART_POLICY,
): Promise<MediaAsset> {
  const mime = baseMime(meta.mime);
  const accepted = policy.accepted[mime];
  if (!accepted) throw new MediaError(policy.notAccepted);
  if (bytes.byteLength === 0) throw new MediaError("Arquivo vazio.");
  if (bytes.byteLength > policy.maxBytes) throw new MediaError(policy.tooBig);

  const id = randomBytes(16).toString("hex");
  const dims = accepted.kind === "image" ? readDimensions(bytes) : undefined;
  const asset: MediaAsset = {
    id,
    url: `/api/media/${id}`,
    kind: accepted.kind,
    mime,
    name: meta.name || `arte.${accepted.ext}`,
    size: bytes.byteLength,
    width: dims?.width,
    height: dims?.height,
    ...(accepted.kind === "audio" ? meta.audio : {}),
    createdAt: new Date().toISOString(),
    ...(meta.owner ? { owner: meta.owner } : {}),
  };

  // Bytes primeiro: um registro sem arquivo daria uma arte quebrada na tela.
  const blob = await putBlob(asset, bytes);
  if (blob) {
    asset.blobUrl = blob.url;
    asset.blobPathname = blob.pathname;
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

/** Os ids dos registros que passam no filtro — para faxina (ver `agency/delete.ts`). */
export async function listMediaIds(match: (asset: MediaAsset) => boolean): Promise<string[]> {
  return Object.values(await index.read()).filter(match).map((a) => a.id);
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
  if (asset.blobPathname) {
    const bytes = await fetchBlobBytes(asset.blobPathname);
    if (!bytes) return undefined;
    return { asset, bytes };
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
async function readBlobHeader(pathname: string): Promise<Uint8Array | undefined> {
  try {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, {
      access: "private",
      headers: { range: `bytes=0-${HEADER_BYTES - 1}` },
      abortSignal: AbortSignal.timeout(HEADER_TIMEOUT_MS),
    });
    if (!result || result.statusCode !== 200) return undefined;
    const buf = await new Response(result.stream).arrayBuffer();
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
 * registrar uma URL externa como arte — `readMedia` busca os bytes pelo
 * `pathname` no store configurado, então aceitar URL do cliente seria abrir
 * um SSRF.
 *
 * O id continua nascendo aqui, aleatório e longo, porque é ele que protege
 * `/api/media/<id>` — servido sem sessão para o link de aprovação.
 */
export async function saveBlobMedia(
  meta: {
    pathname: string;
    name: string;
    owner?: MediaAsset["owner"];
    audio?: AudioMeta;
  },
  policy: MediaPolicy = ART_POLICY,
): Promise<MediaAsset> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new MediaError("Envio direto indisponível: o Blob não está configurado.");
  }
  if (!isMediaBlobPathname(meta.pathname, policy.prefix)) {
    throw new MediaError("Envio inválido.");
  }

  const { head } = await import("@vercel/blob");
  let found: Awaited<ReturnType<typeof head>>;
  try {
    found = await head(meta.pathname);
  } catch {
    throw new MediaError("Arte não chegou ao armazenamento. Tente enviar de novo.");
  }

  const mime = baseMime(found.contentType);
  const accepted = policy.accepted[mime];
  if (!accepted) throw new MediaError(policy.notAccepted);
  if (found.size === 0) throw new MediaError("Arquivo vazio.");
  if (found.size > policy.maxBytes) throw new MediaError(policy.tooBig);

  const id = randomBytes(16).toString("hex");
  const header = accepted.kind === "image" ? await readBlobHeader(found.pathname) : undefined;
  const dims = header ? readDimensions(header) : undefined;
  const asset: MediaAsset = {
    id,
    url: `/api/media/${id}`,
    kind: accepted.kind,
    mime,
    name: meta.name || `arte.${accepted.ext}`,
    size: found.size,
    width: dims?.width,
    height: dims?.height,
    ...(accepted.kind === "audio" ? meta.audio : {}),
    createdAt: new Date().toISOString(),
    blobUrl: found.url,
    blobPathname: found.pathname,
    ...(meta.owner ? { owner: meta.owner } : {}),
  };

  await index.transaction((map) => {
    map[id] = asset;
  });

  return asset;
}

/**
 * Prende anexos a uma mensagem — só os que ainda estão soltos e são de quem
 * manda, nesta conversa. Devolve os ids que prendeu; o que não prendeu (já
 * usado, de outra pessoa) não entra na mensagem.
 */
export async function claimAttachments(
  ids: string[],
  owner: { agencyId: string; uploaderId: string; conversationId: string },
  messageId: string,
): Promise<string[]> {
  if (ids.length === 0) return [];
  return index.transaction((map) => {
    const claimed: string[] = [];
    for (const id of ids) {
      const o = map[id]?.owner;
      if (
        !o ||
        o.agencyId !== owner.agencyId ||
        o.uploaderId !== owner.uploaderId ||
        o.conversationId !== owner.conversationId ||
        o.messageId
      ) {
        continue;
      }
      o.messageId = messageId;
      claimed.push(id);
    }
    return claimed;
  });
}

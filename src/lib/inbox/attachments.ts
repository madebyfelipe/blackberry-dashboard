import "server-only";
import { getMedia } from "@/lib/media/store";
import type { MediaAsset } from "@/lib/media/types";
import { ATTACHMENTS_MAX, isGifUrl } from "./constants";
import type { Attachment } from "./types";

/*
 * Os anexos de uma mensagem, resolvidos **no servidor**. O navegador manda
 * só ids (do arquivo que ele acabou de subir) e, para GIF, o endereço
 * escolhido na biblioteca; tipo, nome, tamanho e URL do arquivo vêm do
 * registro da mídia, e o GIF só passa se for do CDN do Giphy ou do Tenor.
 */

const KIND: Record<MediaAsset["kind"], Attachment["kind"]> = {
  image: "imagem",
  video: "video",
  audio: "audio",
  file: "arquivo",
};

export function attachmentFromMedia(media: MediaAsset): Attachment {
  return {
    id: media.id,
    kind: KIND[media.kind],
    url: media.url,
    name: media.name,
    mime: media.mime,
    size: media.size,
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
  };
}

export class AttachmentError extends Error {}

export async function resolveAttachments(input: {
  attachmentIds?: unknown;
  gif?: unknown;
}): Promise<Attachment[]> {
  const ids = Array.isArray(input.attachmentIds)
    ? [...new Set(input.attachmentIds.map(String).filter(Boolean))]
    : [];
  if (ids.length > ATTACHMENTS_MAX) {
    throw new AttachmentError(`Uma mensagem leva até ${ATTACHMENTS_MAX} anexos.`);
  }
  const out: Attachment[] = [];
  for (const id of ids) {
    // O id é o de 32 hex que o registro da mídia devolveu — nada de caminho.
    if (!/^[a-f0-9]{32}$/.test(id)) throw new AttachmentError("Anexo inválido.");
    const media = await getMedia(id);
    if (!media) throw new AttachmentError("Um dos anexos não chegou. Envie de novo.");
    out.push(attachmentFromMedia(media));
  }
  if (input.gif && typeof input.gif === "object") {
    const g = input.gif as Record<string, unknown>;
    const url = String(g.url ?? "");
    if (!isGifUrl(url)) throw new AttachmentError("GIF de origem desconhecida.");
    const size = (v: unknown) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n <= 4000 ? n : undefined;
    };
    const width = size(g.width);
    const height = size(g.height);
    out.push({
      id: `gif-${Math.random().toString(36).slice(2, 10)}`,
      kind: "gif",
      url,
      name: String(g.title ?? "GIF").slice(0, 120) || "GIF",
      mime: "image/gif",
      size: 0,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
    });
  }
  return out;
}

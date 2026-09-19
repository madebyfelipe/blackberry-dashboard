import { readMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/*
 * Serve a arte de uma peça.
 *
 * Sem sessão de propósito: o link público de aprovação (`/a/<token>`) precisa
 * carregar as imagens no navegador do cliente, que não tem login. O que
 * protege é o id — 16 bytes aleatórios, não sequencial e não listável.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const found = await readMedia(id);
  if (!found) return new Response("Arte não encontrada.", { status: 404 });

  const { asset, bytes } = found;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": asset.mime,
      "content-length": String(bytes.byteLength),
      // O id nunca é reaproveitado: o conteúdo de uma URL não muda.
      "cache-control": "private, max-age=31536000, immutable",
      "content-disposition": `inline; filename="${encodeURIComponent(asset.name)}"`,
    },
  });
}

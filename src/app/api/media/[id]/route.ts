import { NextResponse } from "next/server";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { mediaAccess } from "@/lib/media/access";
import { getMedia, presignMediaUrl, readMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/*
 * Serve a arte de uma peça.
 *
 * Sem sessão de propósito: o link público de aprovação (`/a/<token>`) precisa
 * carregar as imagens no navegador do cliente, que não tem login. O que
 * protege é o id — 16 bytes aleatórios, não sequencial e não listável — e,
 * desde a issue #39, o próprio store: o objeto no Blob é privado, então
 * ninguém abre a arte só de ter a `blobUrl`.
 *
 * Mas isso só vale para a arte do lote (e para foto de perfil/logo, que
 * aparecem fora de sessão no link público). Contrato da ficha e anexo de
 * conversa não são para o cliente ver, então nascem com `agencyId` no
 * registro (issue #111) — `mediaAccess` decide se esta arte pode sair sem
 * sessão ou só para quem está na mesma agência.
 *
 * Quando a arte está no Blob, aqui vai um **redirect** para uma URL assinada
 * de 5 minutos, em vez dos bytes. Não é otimização: a resposta de uma função
 * na Vercel tem o mesmo teto de 4,5 MB que o corpo da requisição, então
 * devolver uma arte de 9 MB por aqui daria `413` — a imagem subiria e não
 * apareceria. No redirect o navegador pega os bytes direto do CDN do Blob,
 * sem passar pela função, só que agora com uma URL que expira sozinha.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const stored = await getMedia(id);
  if (stored?.agencyId) {
    const session = await requireAgency();
    const access = mediaAccess(stored, session?.scope.agencyId);
    if (access === "sem-sessao") return unauthorized();
    if (access === "outra-agencia") return new Response("Arte não encontrada.", { status: 404 });
  }
  if (stored?.blobPathname) {
    // 307: o id não muda de arte, mas a URL assinada muda a cada pedido.
    const url = await presignMediaUrl(stored.blobPathname);
    return NextResponse.redirect(url, 307);
  }

  // Disco ou memória (dev local sem Blob): arquivos pequenos, cabem no corpo.
  const found = await readMedia(id);
  if (!found) return new Response("Arte não encontrada.", { status: 404 });

  const { asset, bytes } = found;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": asset.mime,
      "content-length": String(bytes.byteLength),
      // O id nunca é reaproveitado: o conteúdo de uma URL não muda.
      "cache-control": "private, max-age=31536000, immutable",
      // Imagem, vídeo e áudio abrem na página; documento baixa. E o navegador
      // nunca adivinha outro tipo — o anexo não vira página do app.
      "content-disposition": `${asset.kind === "file" ? "attachment" : "inline"}; filename="${encodeURIComponent(asset.name)}"`,
      "x-content-type-options": "nosniff",
    },
  });
}

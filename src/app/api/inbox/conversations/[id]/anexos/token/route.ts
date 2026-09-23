import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { unauthorized } from "@/lib/auth/session";
import { getConversation } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { ATTACHMENT_POLICY, isMediaBlobPathname } from "@/lib/media/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/*
 * Token de upload direto para o Vercel Blob — o mesmo caminho das artes do
 * lote (ver a rota `media/token` das peças e o README, "O teto de 4,5 MB"),
 * com as regras do anexo: estar na conversa, pasta `anexos/`, os tipos da
 * conversa e 20 MB. O Blob passa a impor tipo e tamanho por conta própria.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Envio direto indisponível: o Blob não está configurado." },
      { status: 503 },
    );
  }
  const { id } = await params;
  if (!(await getConversation(session.scope, session.me.id, id))) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request: req,
      body: body as Parameters<typeof handleUpload>[0]["body"],
      onBeforeGenerateToken: async (pathname) => {
        if (!isMediaBlobPathname(pathname, ATTACHMENT_POLICY.prefix)) {
          throw new Error("Caminho de anexo inválido.");
        }
        return {
          allowedContentTypes: Object.keys(ATTACHMENT_POLICY.accepted),
          maximumSizeInBytes: ATTACHMENT_POLICY.maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao autorizar o envio." },
      { status: 400 },
    );
  }
}

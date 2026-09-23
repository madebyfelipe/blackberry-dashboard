import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { attachmentFromMedia } from "@/lib/inbox/attachments";
import { getConversation } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { ATTACHMENT_POLICY } from "@/lib/media/constants";
import { MediaError, saveBlobMedia, saveMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Registra um anexo da conversa e devolve o que a mensagem vai levar. Os
 * dois caminhos das artes: JSON `{ pathname, name }` quando o arquivo já foi
 * direto para o Blob (produção), multipart `file` sem Blob (dev local).
 *
 * O anexo ainda não é mensagem — ele entra nela no envio, pelo id que sai
 * daqui (ver `resolveAttachments`).
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;
  if (!(await getConversation(session.scope, session.me.id, id))) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  // O anexo nasce preso a quem subiu e a esta conversa — ver `resolveAttachments`.
  const owner = {
    agencyId: session.scope.agencyId,
    uploaderId: session.me.id,
    conversationId: id,
    messageId: null,
  };
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  try {
    let media;
    if (isJson) {
      const body = (await req.json()) as Record<string, unknown>;
      const pathname = typeof body?.pathname === "string" ? body.pathname : "";
      if (!pathname) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
      media = await saveBlobMedia(
        { pathname, name: typeof body?.name === "string" ? body.name.slice(0, 160) : "", owner },
        ATTACHMENT_POLICY,
      );
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
      }
      media = await saveMedia(
        new Uint8Array(await file.arrayBuffer()),
        { mime: file.type, name: file.name.slice(0, 160), owner },
        ATTACHMENT_POLICY,
      );
    }
    return NextResponse.json({ attachment: attachmentFromMedia(media) }, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof TypeError) {
      return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    }
    throw err;
  }
}

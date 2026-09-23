import { NextResponse } from "next/server";
import { ValidationError, conversationAudience, sendMessage } from "@/lib/inbox/repository";
import { AttachmentError, resolveAttachments } from "@/lib/inbox/attachments";
import { attachmentsLabel } from "@/lib/inbox/constants";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { notifyMessage } from "@/lib/notifications/dispatch";
import { publishToConversation } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Manda a mensagem. Quem escreveu sai da sessão — o corpo manda o texto e,
 * se houver, os anexos (ids do que acabou de subir, ou o GIF escolhido) e a
 * mensagem que ela responde.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { text, attachmentIds, gif, replyToId } = (body ?? {}) as Record<string, unknown>;

  try {
    const attachments = await resolveAttachments({ attachmentIds, gif });
    const conversation = await sendMessage(
      session.scope,
      session.me.id,
      id,
      String(text ?? ""),
      { attachments, replyToId: typeof replyToId === "string" ? replyToId : null },
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }
    const said = String(text ?? "").trim() || attachmentsLabel(attachments);
    const group = conversation.kind === "grupo" ? conversation.title : "";
    /*
     * Avisa quem está com a conversa aberta. Depois da gravação, nunca no
     * lugar dela: o evento é só um empurrão ("tem coisa nova aqui"), e quem
     * recebe vai buscar o conteúdo pela API de sempre. Assim existe uma
     * verdade só, e o tempo real fora do ar atrasa a entrega em vez de
     * inventar uma segunda versão da conversa.
     */
    await publishToConversation(session.scope, id, {
      tipo: "mensagem",
      conversationId: id,
      // O bastante para a notificação de quem não está com a conversa aberta.
      from: { id: session.me.id, name: session.me.name },
      group,
      preview: said.slice(0, 140),
    });
    // E a lista de Notificações de cada um (menção, ou "mensagem nova").
    const audience = await conversationAudience(session.scope, session.me.id, id);
    if (audience) {
      await notifyMessage(
        session.scope,
        { id: session.me.id, name: session.me.name },
        { id, kind: conversation.kind, group, ...audience },
        said,
      );
    }
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof AttachmentError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

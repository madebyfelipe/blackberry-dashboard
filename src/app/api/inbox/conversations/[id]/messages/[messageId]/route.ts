import { NextResponse } from "next/server";
import {
  ForbiddenError,
  ValidationError,
  deleteMessage,
  editMessage,
} from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { deleteMedia } from "@/lib/media/store";
import { attachmentsLabel } from "@/lib/inbox/constants";
import { redactNotifications } from "@/lib/notifications/repository";
import { excerpt } from "@/lib/notifications/view";
import { publishToConversation } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; messageId: string }> };

const NOT_FOUND = { error: "Mensagem não encontrada." };

/*
 * Editar e apagar a própria mensagem, até 10 minutos depois de enviada (a
 * regra é do repositório, `canChangeMessage`). Os dois avisam a conversa
 * pelo tempo real **sem** `from`: é para a tela de quem está nela reler, não
 * para virar notificação de mensagem nova.
 */

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id, messageId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { text } = (body ?? {}) as Record<string, unknown>;
  try {
    const conversation = await editMessage(session.scope, session.me.id, id, messageId, String(text ?? ""));
    if (!conversation) return NextResponse.json(NOT_FOUND, { status: 404 });
    await publishToConversation(session.scope, id, { tipo: "mensagem", conversationId: id });
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id, messageId } = await params;
  try {
    const result = await deleteMessage(session.scope, session.me.id, id, messageId);
    if (!result) return NextResponse.json(NOT_FOUND, { status: 404 });
    // Os arquivos que a mensagem levava saem junto (o GIF não é nosso).
    await Promise.all(
      result.removed
        .filter((a) => a.kind !== "gif")
        .map((a) => deleteMedia(a.id).catch(() => undefined)),
    );
    // O aviso que alguém recebeu dela também para de mostrar o texto.
    await redactNotifications(
      session.scope,
      `conversa:${id}`,
      excerpt(result.text || attachmentsLabel(result.removed)),
      "Mensagem apagada",
    );
    await publishToConversation(session.scope, id, { tipo: "mensagem", conversationId: id });
    return NextResponse.json({ conversation: result.conversation });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

import { NextResponse } from "next/server";
import { ValidationError, sendMessage } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { publishToConversation } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Manda a mensagem. Quem escreveu sai da sessão — o corpo manda só o texto,
 * como o comentário da tarefa.
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
  const { text } = (body ?? {}) as Record<string, unknown>;

  try {
    const conversation = await sendMessage(
      session.scope,
      session.me.id,
      id,
      String(text ?? ""),
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }
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
      group: conversation.kind === "grupo" ? conversation.title : "",
      preview: String(text ?? "").trim().slice(0, 140),
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

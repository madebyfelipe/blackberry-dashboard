import { NextResponse } from "next/server";
import { ValidationError, sendMessage } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
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
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

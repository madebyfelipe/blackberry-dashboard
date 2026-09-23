import { NextResponse } from "next/server";
import { addTaskComment, ValidationError } from "@/lib/tasks/repository";
import { unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { notifyTaskComment } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Comentário da tela de descrição da tarefa. Quem escreveu sai da sessão — o
 * corpo manda só o texto, como o `POST /api/tasks` faz com o criador.
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
    const task = await addTaskComment(session.scope, id, {
      author: session.user.name,
      text: String(text ?? ""),
    });
    // Mesma resposta para "não existe" e "é de outra agência".
    if (!task) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }
    // Quem foi marcado no comentário, e o responsável da tarefa.
    await notifyTaskComment(
      session.scope,
      { id: session.me.id, name: session.me.name },
      task,
      String(text ?? "").trim(),
    );
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

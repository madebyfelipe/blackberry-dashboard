import { NextResponse } from "next/server";
import { ValidationError, registerCall } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Registra a chamada que terminou — a linha de sistema do histórico.
 *
 * O corpo manda só a duração, e mesmo ela é conferida e arredondada no
 * servidor; a frase ("Fulano iniciou uma chamada que durou 12 minutos") é
 * montada lá, com o nome vindo da sessão.
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
  const { seconds } = (body ?? {}) as Record<string, unknown>;

  try {
    const conversation = await registerCall(
      session.scope,
      session.me.id,
      id,
      Number(seconds),
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

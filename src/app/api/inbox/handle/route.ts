import { NextResponse } from "next/server";
import { ValidationError, setHandle } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Troca o seu @ — só o seu: o membro alterado vem da sessão. */
export async function PATCH(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { handle } = (body ?? {}) as Record<string, unknown>;

  try {
    const me = await setHandle(session.scope, session.me.id, String(handle ?? ""));
    if (!me) {
      return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ me });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

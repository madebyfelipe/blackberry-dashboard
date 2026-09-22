import { NextResponse } from "next/server";
import { ValidationError, setPresence } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { ablyEnabled, livekitEnabled } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";
import type { Presence } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

/** Sua disponibilidade atual — é o que o menu da sua conta mostra marcado. */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  return NextResponse.json({
    me: session.me,
    realtime: { eventos: ablyEnabled(), chamada: livekitEnabled() },
  });
}

/** Sua disponibilidade — só a sua: o membro alterado vem da sessão. */
export async function PATCH(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { presence } = (body ?? {}) as Record<string, unknown>;

  try {
    const me = await setPresence(
      session.scope,
      session.me.id,
      presence as Presence,
    );
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

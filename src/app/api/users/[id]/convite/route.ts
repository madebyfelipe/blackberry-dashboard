import { NextResponse } from "next/server";
import { ForbiddenError, ValidationError, renewInvite } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";
import { toUserRow } from "@/lib/team/rows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** "Reenviar acesso": link de convite novo; o anterior deixa de valer. */
export async function POST(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;
  try {
    const member = await renewInvite(session.scope, session.me.id, id);
    if (!member) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    return NextResponse.json({ user: toUserRow(member, session.me) });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

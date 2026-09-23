import { NextResponse } from "next/server";
import { ForbiddenError, ValidationError, inviteMember } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";
import { toUserRow } from "@/lib/team/rows";
import type { MemberRole } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

/** "Adicionar usuário": convite pendente, com o link de cadastro na resposta. */
export async function POST(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { name, email, role } = (body ?? {}) as Record<string, unknown>;
  try {
    const member = await inviteMember(session.scope, session.me.id, {
      name: String(name ?? ""),
      email: String(email ?? ""),
      role: String(role ?? "editor") as MemberRole,
    });
    return NextResponse.json({ user: toUserRow(member, session.me) }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

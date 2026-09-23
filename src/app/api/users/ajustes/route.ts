import { NextResponse } from "next/server";
import { ForbiddenError, ValidationError, getTeamSettings, setTeamDomain } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";
import type { MemberRole } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

/** O domínio do convite automático e a função com que os pedidos entram. */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  return NextResponse.json({ settings: await getTeamSettings(session.scope) });
}

export async function PATCH(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { domain, domainRole } = (body ?? {}) as Record<string, unknown>;
  try {
    const settings = await setTeamDomain(session.scope, session.me.id, {
      domain: domain ? String(domain) : null,
      domainRole: domainRole ? (String(domainRole) as MemberRole) : undefined,
    });
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

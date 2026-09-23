import { NextResponse } from "next/server";
import { listMembers } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * O time da agência — quem dá para mencionar e atribuir, com o @ de cada um.
 * Só nome e @: e-mail e presença ficam nas telas que precisam deles.
 */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const members = await listMembers(session.scope);
  return NextResponse.json({
    me: session.me.id,
    members: members.map((m) => ({ id: m.id, name: m.name, handle: m.handle })),
  });
}

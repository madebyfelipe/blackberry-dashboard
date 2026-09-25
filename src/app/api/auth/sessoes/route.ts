import { NextResponse } from "next/server";
import { revokeSessions } from "@/lib/auth/repository";
import { endSession, requireUser, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * "Sair de todos os aparelhos": todo token desta conta deixa de valer (ver
 * `revokeSessions`), inclusive o deste aparelho — que também perde o cookie.
 */
export async function DELETE() {
  const user = await requireUser();
  if (!user) return unauthorized();
  await revokeSessions(user.id);
  await endSession();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { deleteNotification } from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Tira a notificação da sua lista. A de outra pessoa responde como inexistente. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const ok = await deleteNotification(session.scope, session.me.id, id);
  if (!ok) return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

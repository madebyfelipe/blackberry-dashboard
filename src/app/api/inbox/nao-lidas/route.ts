import { NextResponse } from "next/server";
import { listConversations } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * O número ao lado de "Inbox" na lateral (o "12" do export): mensagens não
 * lidas nas conversas que você não silenciou. Só o número — a lateral não
 * precisa das conversas.
 */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const conversations = await listConversations(session.scope, session.me.id);
  const total = conversations.filter((c) => !c.muted).reduce((sum, c) => sum + c.unread, 0);
  return NextResponse.json({ total });
}

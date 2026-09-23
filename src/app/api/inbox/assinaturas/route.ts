import { NextResponse } from "next/server";
import { listConversations } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * O que o notificador do shell ouve: as conversas de que você participa (e
 * quais você silenciou), com a agência e o seu id para montar os canais.
 * Leve de propósito — sem mensagens.
 */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const conversations = await listConversations(session.scope, session.me.id);
  return NextResponse.json({
    agencyId: session.scope.agencyId,
    me: session.me.id,
    // O resto serve ao aviso por releitura (sem tempo real): quem mudou desde a última vez.
    conversations: conversations.map((c) => ({
      id: c.id,
      muted: c.muted,
      kind: c.kind,
      title: c.title,
      preview: c.preview,
      unread: c.unread,
      lastAt: c.lastAt,
      callMemberIds: c.callMemberIds,
    })),
  });
}

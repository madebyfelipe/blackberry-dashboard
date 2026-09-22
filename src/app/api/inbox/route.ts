import { NextResponse } from "next/server";
import { listConversations, listMembers } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * O estado do Inbox para quem abriu a tela: ele mesmo, a equipe e as conversas
 * de que ele participa (já resolvidas — título, prévia, não lidas).
 *
 * É esta rota que a tela repete de tempos em tempos enquanto está aberta.
 * Ainda não existe camada de tempo real no projeto (WebSocket/WebRTC) — ver
 * `ROADMAP.md`; até lá, quem busca o que chegou é o navegador.
 */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  const [members, conversations] = await Promise.all([
    listMembers(session.scope),
    listConversations(session.scope, session.me.id),
  ]);

  return NextResponse.json({ me: session.me, members, conversations });
}

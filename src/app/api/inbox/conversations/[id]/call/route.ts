import { NextResponse } from "next/server";
import { joinCall, leaveCall } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { livekitToken, publishToConversation } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Conversa não encontrada." };

/**
 * Entrar na chamada da conversa.
 *
 * Duas coisas acontecem juntas e nesta ordem: o registro (quem está na
 * chamada agora, para quem abrir a conversa depois ver e poder entrar) e o
 * crachá do LiveKit, que é o que deixa áudio e tela realmente passarem.
 *
 * O crachá é emitido aqui, e só aqui: ele vale para **uma** sala — a desta
 * conversa — e leva a identidade do membro. Quem não está na conversa não
 * chega nesta linha, então não existe caminho para entrar numa sala alheia.
 *
 * Sem as variáveis do LiveKit a rota continua respondendo: a chamada abre
 * sem mídia, contando o tempo e deixando o registro no histórico, como era
 * antes de existir provedor.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const conversation = await joinCall(session.scope, session.me.id, id);
  if (!conversation) return NextResponse.json(NOT_FOUND, { status: 404 });

  const media = await livekitToken(session.scope, id, session.me);

  await publishToConversation(session.scope, id, {
    tipo: "chamada",
    conversationId: id,
    memberIds: conversation.callMemberIds,
  });

  return NextResponse.json({ conversation, media: media ?? null });
}

/**
 * Sair da chamada. A última pessoa a sair fecha a chamada e é aí que a linha
 * entra no histórico — ver `leaveCall`.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const conversation = await leaveCall(session.scope, session.me.id, id);
  if (!conversation) return NextResponse.json(NOT_FOUND, { status: 404 });

  await publishToConversation(session.scope, id, {
    tipo: "chamada",
    conversationId: id,
    memberIds: conversation.callMemberIds,
  });

  return NextResponse.json({ conversation });
}

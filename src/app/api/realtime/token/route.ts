import { NextResponse } from "next/server";
import { listConversations } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { ablyTokenRequest } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * O crachá do tempo real.
 *
 * A chave do Ably é a chave-raiz da conta e **nunca sai do servidor**. O
 * navegador chega aqui com o cookie de sessão e recebe um pedido de token
 * assinado, válido por uma hora, com permissão só para o canal de presença da
 * agência dele e para os canais das conversas de que ele participa — a lista
 * é montada agora, a partir do repositório, não pedida pelo cliente.
 *
 * É esta rota que o cliente do Ably chama sozinho quando o token vence, então
 * ela precisa devolver o pedido cru, sem embrulho.
 */
export async function GET() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  const conversations = await listConversations(session.scope, session.me.id);
  const tokenRequest = await ablyTokenRequest(
    session.scope,
    session.me.id,
    conversations.map((c) => c.id),
  );
  if (!tokenRequest) {
    return NextResponse.json(
      { error: "Tempo real não está configurado." },
      { status: 503 },
    );
  }
  return NextResponse.json(tokenRequest);
}

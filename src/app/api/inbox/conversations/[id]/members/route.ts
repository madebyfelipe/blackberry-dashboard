import { NextResponse } from "next/server";
import { ValidationError, addGroupMember } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { notifyMembers, publishToConversation } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Adiciona alguém do time a um grupo de que você participa. Numa direta a
 * resposta é 422: lá, adicionar alguém cria um grupo novo (POST em
 * `/api/inbox/conversations` com `memberIds`), para o histórico de duas
 * pessoas continuar sendo de duas pessoas.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { memberId } = (body ?? {}) as Record<string, unknown>;

  try {
    const conversation = await addGroupMember(
      session.scope,
      session.me.id,
      id,
      String(memberId ?? ""),
    );
    // Mesma resposta para conversa alheia, de outra agência ou pessoa que não existe.
    if (!conversation) {
      return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    }
    // Quem já estava vê o aviso na conversa; quem entrou fica sabendo do grupo.
    await Promise.all([
      publishToConversation(session.scope, id, { tipo: "mensagem", conversationId: id }),
      notifyMembers(session.scope, [String(memberId)], id),
    ]);
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

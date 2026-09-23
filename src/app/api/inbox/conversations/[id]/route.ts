import { NextResponse } from "next/server";
import { getConversation, setMuted, setRead } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";
import { markNotifications } from "@/lib/notifications/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Conversa não encontrada." };

/**
 * A conversa aberta, com o histórico inteiro — ele fica salvo, é o que a
 * busca da tela varre.
 *
 * "Não encontrada" cobre três casos de propósito: id que não existe, conversa
 * de outra agência e conversa desta agência em que a pessoa não está. Dizer
 * qual dos três seria dizer que ela existe.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const conversation = await getConversation(session.scope, session.me.id, id);
  if (!conversation) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ conversation });
}

/**
 * O que é de quem está olhando, e só dele: lida/não lida e silenciada.
 * Silenciar para todo mundo seria outra coisa — e não é o que o sininho
 * cortado da lista significa.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { read, muted } = (body ?? {}) as Record<string, unknown>;

  let summary;
  if (typeof muted === "boolean") {
    summary = await setMuted(session.scope, session.me.id, id, muted);
    if (!summary) return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  if (typeof read === "boolean") {
    summary = await setRead(session.scope, session.me.id, id, read);
    if (!summary) return NextResponse.json(NOT_FOUND, { status: 404 });
    // Ler a conversa é ler os avisos dela (mensagens e menções).
    if (read) await markNotifications(session.scope, session.me.id, { ref: `conversa:${id}` });
  }
  if (!summary) {
    return NextResponse.json(
      { error: "Nada para alterar." },
      { status: 422 },
    );
  }
  return NextResponse.json({ conversation: summary });
}

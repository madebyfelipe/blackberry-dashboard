import { NextResponse } from "next/server";
import { ValidationError, createGroup, openDirect } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { notifyMembers } from "@/lib/realtime/server";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Abre uma conversa nova.
 *
 * - `{ memberId }` — a direta com alguém do time (o "escrever" do topo da
 *   lista). Se ela já existir, volta a mesma: não se cria um segundo
 *   histórico com a mesma pessoa.
 * - `{ memberIds, name? }` — um grupo com você e essas pessoas (o
 *   "adicionar alguém" de uma direta). Você entra sempre, venha ou não na
 *   lista: quem cria vem da sessão, nunca do corpo.
 */
export async function POST(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { memberId, memberIds, name } = (body ?? {}) as Record<string, unknown>;

  try {
    if (Array.isArray(memberIds)) {
      const group = await createGroup(
        session.scope,
        session.me.id,
        memberIds.map(String),
        typeof name === "string" ? name : "",
      );
      if (!group) {
        return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
      }
      // Quem foi incluído ainda não ouve o canal deste grupo: o aviso vai
      // no canal pessoal de cada um.
      await notifyMembers(
        session.scope,
        group.memberIds.filter((m) => m !== session.me.id),
        group.id,
      );
      return NextResponse.json({ conversation: group }, { status: 201 });
    }

    const conversation = await openDirect(
      session.scope,
      session.me.id,
      String(memberId ?? ""),
    );
    // Mesma resposta para "não existe" e "é de outra agência".
    if (!conversation) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

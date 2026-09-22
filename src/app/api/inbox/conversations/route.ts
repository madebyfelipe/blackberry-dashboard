import { NextResponse } from "next/server";
import { ValidationError, openDirect } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Abre a direta com alguém do time (o "escrever" do topo da lista). Se ela já
 * existir, volta a mesma — não se cria um segundo histórico com a mesma
 * pessoa. Grupo novo ainda não tem desenho, então esta rota só faz direta.
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
  const { memberId } = (body ?? {}) as Record<string, unknown>;

  try {
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

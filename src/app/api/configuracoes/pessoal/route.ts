import { NextResponse } from "next/server";
import { AuthError, updateProfile } from "@/lib/auth/repository";
import { unauthorized } from "@/lib/auth/session";
import { ValidationError, updateMyProfile } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import type { Presence } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

/**
 * Salvar alterações de Configurações › Pessoal: nome (da conta), cargo,
 * disponibilidade e avisos (do membro do time). Sempre de quem está logado —
 * o id vem da sessão, nunca do corpo. O @ tem rota própria (`/api/inbox/handle`)
 * porque é único na agência e tem a régua dele.
 */
export async function PATCH(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    let user = session.user;
    if (body.name !== undefined) user = await updateProfile(session.user.id, { name: String(body.name) });
    const me = await updateMyProfile(session.scope, session.me.id, {
      title: body.title === undefined ? undefined : String(body.title),
      notify: body.notify,
      presence: body.presence === undefined ? undefined : (body.presence as Presence),
    });
    if (!me) return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
    return NextResponse.json({ user, me });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

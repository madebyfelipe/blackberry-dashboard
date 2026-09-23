import { NextResponse } from "next/server";
import {
  ForbiddenError,
  ValidationError,
  deleteMember,
  updateMember,
  type MemberPatch,
} from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { unauthorized } from "@/lib/auth/session";
import { toUserRow } from "@/lib/team/rows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown) {
  if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
  if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
  throw err;
}

/** Editar, arquivar, reativar. Só nome, função e status vêm do corpo. */
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
  const input = (body ?? {}) as Record<string, unknown>;
  const patch: MemberPatch = {};
  if (input.name !== undefined) patch.name = String(input.name);
  if (input.role !== undefined) patch.role = input.role as MemberPatch["role"];
  if (input.status !== undefined) patch.status = input.status as MemberPatch["status"];
  try {
    const member = await updateMember(session.scope, session.me.id, id, patch);
    if (!member) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    return NextResponse.json({ user: toUserRow(member, session.me) });
  } catch (err) {
    return fail(err);
  }
}

/** Excluir — só convite pendente (ver `deleteMember`). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;
  try {
    const ok = await deleteMember(session.scope, session.me.id, id);
    if (!ok) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}

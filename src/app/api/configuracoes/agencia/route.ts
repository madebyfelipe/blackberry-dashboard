import { NextResponse } from "next/server";
import { AuthError, renameAgency } from "@/lib/auth/repository";
import { endSession, unauthorized } from "@/lib/auth/session";
import { deleteAgency } from "@/lib/agency/delete";
import { AgencySettingsError, updateAgencySettings } from "@/lib/agency/repository";
import { ValidationError, setTeamDomain } from "@/lib/inbox/repository";
import { canManageTeam, isAdmin } from "@/lib/inbox/users";
import { currentInboxSession } from "@/lib/inbox/viewer";
import type { MemberRole } from "@/lib/inbox/types";

export const dynamic = "force-dynamic";

/*
 * Configurações › Agência. Gravar é de Admin e Gerente; excluir a agência,
 * só de Admin. A regra está aqui, e não só na tela: quem não vê a aba também
 * não chega à rota.
 */

async function managerSession() {
  const session = await currentInboxSession();
  if (!session) return { error: unauthorized() };
  if (!canManageTeam(session.me)) {
    return { error: NextResponse.json({ error: "Só Admin e Gerente mudam a agência." }, { status: 403 }) };
  }
  return { session };
}

/**
 * Salvar alterações: nome, domínio do convite automático (com a função de
 * quem entra por ele) e os padrões para cliente novo. Cada parte só grava se
 * veio no corpo.
 */
export async function PATCH(req: Request) {
  const { session, error } = await managerSession();
  if (!session) return error;

  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    if (body.clientDefaults !== undefined) {
      await updateAgencySettings(session.scope, { clientDefaults: body.clientDefaults });
    }
    if (body.domain !== undefined || body.domainRole !== undefined) {
      await setTeamDomain(session.scope, session.me.id, {
        domain: body.domain ? String(body.domain) : null,
        domainRole: body.domainRole === undefined ? undefined : (body.domainRole as MemberRole),
      });
    }
    let name = session.scope.agencyName;
    if (body.name !== undefined) name = await renameAgency(session.scope.agencyId, String(body.name));
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    if (err instanceof AgencySettingsError || err instanceof ValidationError || err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

/**
 * Excluir agência. Pede o nome digitado de novo no corpo — a mesma trava da
 * tela, conferida aqui para um clique perdido (ou um pedido forjado) não
 * apagar a agência de ninguém.
 */
export async function DELETE(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  if (!isAdmin(session.me)) {
    return NextResponse.json({ error: "Só um Admin pode excluir a agência." }, { status: 403 });
  }
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const typed = String(body.confirm ?? "").trim().toLocaleLowerCase("pt-BR");
  if (!typed || typed !== session.scope.agencyName.trim().toLocaleLowerCase("pt-BR")) {
    return NextResponse.json({ error: "Digite o nome da agência para confirmar." }, { status: 422 });
  }
  const result = await deleteAgency(session.scope);
  await endSession();
  return NextResponse.json({ ok: true, ...result });
}

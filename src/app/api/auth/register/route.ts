import { NextResponse } from "next/server";
import { AuthError, registerUser } from "@/lib/auth/repository";
import { startSession } from "@/lib/auth/session";
import { findInvite } from "@/lib/inbox/repository";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { name, email, password, agency, role, convite } = (body ?? {}) as Record<
    string,
    unknown
  >;

  /*
   * Convite: a conta entra na agência de quem convidou. O token decide a
   * agência, e o e-mail tem de ser o convidado — sem isso, quem pegasse o
   * link emprestado entraria no time com outro e-mail.
   */
  let joinAgency: { agencyId: never; agencyName: string } | undefined;
  if (convite) {
    const invite = await findInvite(String(convite));
    if (!invite) {
      return NextResponse.json(
        { error: "Este convite não vale mais. Peça um link novo a quem te convidou." },
        { status: 410 },
      );
    }
    if (String(email ?? "").trim().toLowerCase() !== invite.email) {
      return NextResponse.json(
        { error: `Este convite é para ${invite.email}.` },
        { status: 422 },
      );
    }
    joinAgency = { agencyId: invite.agencyId as never, agencyName: invite.agencyName };
  }

  try {
    const user = await registerUser({
      name: String(name ?? ""),
      email: String(email ?? ""),
      password: String(password ?? ""),
      agency: agency === undefined ? undefined : String(agency),
      role: role as never,
      joinAgency,
    });
    // Cadastro já entra logado — é o comportamento esperado do "Criar conta".
    await startSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

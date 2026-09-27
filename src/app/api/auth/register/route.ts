import { NextResponse } from "next/server";
import { AuthError, registerUser } from "@/lib/auth/repository";
import { startSession } from "@/lib/auth/session";
import {
  ValidationError,
  acceptInvite,
  agencyForEmail,
  domainJoinProblem,
  findInvite,
  requestJoin,
} from "@/lib/inbox/repository";
import { agencyNameOf } from "@/lib/auth/repository";

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

  /*
   * Sem convite, mas com e-mail do domínio de uma agência: convite
   * automático. A conta nasce dentro da agência como pedido de entrada, e só
   * enxerga alguma coisa depois que um Admin ou Gerente aprova (o produto não
   * confirma e-mail — ver `lib/inbox/domain.ts`).
   */
  let domainJoin = false;
  if (!joinAgency) {
    const agency = await agencyForEmail(String(email ?? ""));
    if (agency) {
      // E-mail com convite pendente só entra pelo link — o domínio ativaria o
      // convite sem o token (issue #72).
      const problem = await domainJoinProblem(agency.agencyId, String(email ?? ""));
      if (problem) return NextResponse.json({ error: problem }, { status: 422 });
      const agencyName = (await agencyNameOf(agency.agencyId)) ?? agency.agencyName;
      joinAgency = { agencyId: agency.agencyId as never, agencyName };
      domainJoin = true;
    }
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
    if (domainJoin) await requestJoin(user.agencyId, { name: user.name, email: user.email });
    // O cadastro pelo link é o aceite: o convite vira membro ativo e o token
    // morre. Se o convite sumiu no meio (excluído, link renovado), a conta
    // fica sem lugar na agência — e `memberAccess` a barra.
    if (convite) await acceptInvite(String(convite), user.email);
    // Cadastro já entra logado — é o comportamento esperado do "Criar conta".
    await startSession(user.id);
    return NextResponse.json({ user, pending: domainJoin }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError || err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

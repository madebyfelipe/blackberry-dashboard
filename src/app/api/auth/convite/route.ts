import { NextResponse } from "next/server";
import { findInvite } from "@/lib/inbox/repository";

export const dynamic = "force-dynamic";

/**
 * O que a tela de cadastro mostra de um convite: para qual e-mail e para qual
 * agência. Sem sessão — o token é a autorização —, e sem nada além disso.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const invite = await findInvite(token);
  if (!invite) {
    return NextResponse.json({ error: "Convite inválido ou já usado." }, { status: 404 });
  }
  return NextResponse.json({
    email: invite.email,
    name: invite.name,
    agency: invite.agencyName,
  });
}

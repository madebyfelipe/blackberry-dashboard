import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/*
 * Recuperação de senha — o envio de e-mail ainda não existe (ROADMAP:
 * "Envio do link por WhatsApp/e-mail"). A resposta é deliberadamente a mesma
 * exista ou não a conta: não entrega quais e-mails estão cadastrados.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { email } = (body ?? {}) as Record<string, unknown>;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? ""))) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    pending: "envio-de-email",
  });
}

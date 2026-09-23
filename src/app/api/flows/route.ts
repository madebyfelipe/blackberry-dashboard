import { NextResponse } from "next/server";
import { ValidationError, createFlow, listFlows } from "@/lib/flows/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAgency();
  if (!session) return unauthorized();
  return NextResponse.json({ flows: await listFlows(session.scope) });
}

/** "Novo fluxo": nasce desligado, com uma etapa, para ser montado na tela. */
export async function POST(req: Request) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { name, template } = (body ?? {}) as Record<string, unknown>;
  try {
    const flow = await createFlow(session.scope, {
      name: String(name ?? ""),
      by: session.user.name,
      template: template === "social-media" ? "social-media" : undefined,
    });
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

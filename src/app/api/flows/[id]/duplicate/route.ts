import { NextResponse } from "next/server";
import { duplicateFlow } from "@/lib/flows/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id } = await params;
  const flow = await duplicateFlow(session.scope, id, session.user.name);
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  return NextResponse.json({ flow }, { status: 201 });
}

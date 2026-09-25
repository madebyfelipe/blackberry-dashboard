import { NextResponse } from "next/server";
import { addEvent } from "@/lib/crm/repository";
import { withClient } from "@/lib/crm/http";
import type { ClientEvent } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Um compromisso na agenda do cliente. Quem marcou vem da sessão. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withClient(req, id, async ({ session, body }) => {
    const account = await addEvent(session.scope, id, {
      kind: body.kind as ClientEvent["kind"],
      title: String(body.title ?? ""),
      at: String(body.at ?? ""),
      place: String(body.place ?? ""),
      createdBy: session.user.name,
    });
    return NextResponse.json({ account }, { status: 201 });
  });
}

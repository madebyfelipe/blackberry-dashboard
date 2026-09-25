import { NextResponse } from "next/server";
import { removeEvent } from "@/lib/crm/repository";
import { notFound, withClient } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; eventId: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const { id, eventId } = await params;
  return withClient(
    req,
    id,
    async ({ session }) => {
      const account = await removeEvent(session.scope, id, eventId);
      return account ? NextResponse.json({ account }) : notFound("Evento não encontrado.");
    },
    { body: false },
  );
}

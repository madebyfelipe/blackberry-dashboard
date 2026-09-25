import { NextResponse } from "next/server";
import { removeService, updateService } from "@/lib/crm/repository";
import { notFound, pickService, withClient } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; serviceId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id, serviceId } = await params;
  return withClient(req, id, async ({ session, body }) => {
    const account = await updateService(session.scope, id, serviceId, pickService(body));
    return account ? NextResponse.json({ account }) : notFound("Serviço não encontrado.");
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id, serviceId } = await params;
  return withClient(
    req,
    id,
    async ({ session }) => {
      const account = await removeService(session.scope, id, serviceId);
      return account ? NextResponse.json({ account }) : notFound("Serviço não encontrado.");
    },
    { body: false },
  );
}

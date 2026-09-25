import { NextResponse } from "next/server";
import { addService } from "@/lib/crm/repository";
import { pickService, withClient } from "@/lib/crm/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** "Adicionar serviço". */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withClient(req, id, async ({ session, body }) => {
    const account = await addService(session.scope, id, pickService(body));
    return NextResponse.json({ account }, { status: 201 });
  });
}

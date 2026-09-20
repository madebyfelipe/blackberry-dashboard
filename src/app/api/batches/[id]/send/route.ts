import { NextResponse } from "next/server";
import { sendBatchForApproval } from "@/lib/approval/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAgency();
  if (!session) return unauthorized("Faça login para enviar o lote.");
  const { id } = await params;
  const batch = await sendBatchForApproval(session.scope, id);
  if (!batch) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ batch });
}

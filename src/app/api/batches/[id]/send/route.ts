import { NextResponse } from "next/server";
import { sendBatchForApproval } from "@/lib/approval/repository";
import { requireUser, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireUser())) return unauthorized("Faça login para enviar o lote.");
  const { id } = await params;
  const batch = await sendBatchForApproval(id);
  if (!batch) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ batch });
}

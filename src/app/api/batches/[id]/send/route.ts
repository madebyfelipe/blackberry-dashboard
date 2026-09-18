import { NextResponse } from "next/server";
import { sendBatchForApproval } from "@/lib/approval/repository";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const batch = await sendBatchForApproval(id);
  if (!batch) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ batch });
}

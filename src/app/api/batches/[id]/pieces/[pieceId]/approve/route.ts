import { NextResponse } from "next/server";
import { approvePieceByAgency } from "@/lib/approval/repository";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  const { id, pieceId } = await params;
  const piece = await approvePieceByAgency(id, pieceId);
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ piece });
}

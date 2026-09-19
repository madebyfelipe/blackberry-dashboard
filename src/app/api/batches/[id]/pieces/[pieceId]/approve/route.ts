import { NextResponse } from "next/server";
import { approvePieceByAgency } from "@/lib/approval/repository";
import { requireUser, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  // Aprovação da agência exige sessão; a do cliente entra por /api/approve/<token>.
  if (!(await requireUser())) return unauthorized();
  const { id, pieceId } = await params;
  const piece = await approvePieceByAgency(id, pieceId);
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ piece });
}

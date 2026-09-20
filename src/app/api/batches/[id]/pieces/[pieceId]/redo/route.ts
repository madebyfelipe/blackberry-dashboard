import { NextResponse } from "next/server";
import { markPieceRedone } from "@/lib/approval/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id, pieceId } = await params;
  const piece = await markPieceRedone(session.scope, id, pieceId);
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ piece });
}

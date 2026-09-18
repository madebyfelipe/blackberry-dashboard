import { NextResponse } from "next/server";
import { addPiece } from "@/lib/approval/repository";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const piece = await addPiece(id);
  if (!piece) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ piece }, { status: 201 });
}

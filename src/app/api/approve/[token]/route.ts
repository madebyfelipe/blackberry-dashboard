import { NextResponse } from "next/server";
import { decidePiece } from "@/lib/approval/repository";
import type { PieceStatus } from "@/lib/approval/types";

export const dynamic = "force-dynamic";

const VALID: PieceStatus[] = ["aprovado", "ajuste", "pendente"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const pieceId = String(body.pieceId ?? "");
  const decision = String(body.decision ?? "") as PieceStatus;
  const reason = body.reason ? String(body.reason) : undefined;
  const who = body.who ? String(body.who) : undefined;

  if (!pieceId || !VALID.includes(decision)) {
    return NextResponse.json({ error: "Decisão inválida." }, { status: 422 });
  }
  if (decision === "ajuste" && !reason?.trim()) {
    return NextResponse.json(
      { error: "A reprovação exige um motivo." },
      { status: 422 },
    );
  }

  const piece = await decidePiece(token, pieceId, decision, { reason, who });
  if (!piece) {
    return NextResponse.json(
      { error: "Lote ou peça não encontrados." },
      { status: 404 },
    );
  }
  return NextResponse.json({ piece });
}

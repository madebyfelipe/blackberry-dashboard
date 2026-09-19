import { NextResponse } from "next/server";
import { updatePieceDraft } from "@/lib/approval/repository";
import { PIECE_CHANNELS, PIECE_FORMATS } from "@/lib/approval/constants";
import type { PieceChannel, PieceDraftPatch, PieceFormat } from "@/lib/approval/types";
import { requireUser, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const FORMAT_IDS = PIECE_FORMATS.map((f) => f.id);
const CHANNEL_IDS = PIECE_CHANNELS.map((c) => c.id);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  if (!(await requireUser())) return unauthorized("Faça login para editar o lote.");
  const { id, pieceId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const patch: PieceDraftPatch = {};
  if (typeof body.caption === "string") patch.caption = body.caption;
  if (typeof body.hashtags === "string") patch.hashtags = body.hashtags;
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.date === "string" && !Number.isNaN(Date.parse(body.date))) {
    patch.date = new Date(body.date).toISOString();
  }
  if (typeof body.format === "string") {
    if (!FORMAT_IDS.includes(body.format as PieceFormat)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 422 });
    }
    patch.format = body.format as PieceFormat;
  }
  if (typeof body.channel === "string") {
    if (!CHANNEL_IDS.includes(body.channel as PieceChannel)) {
      return NextResponse.json({ error: "Canal inválido." }, { status: 422 });
    }
    patch.channel = body.channel as PieceChannel;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para salvar." }, { status: 422 });
  }

  const result = await updatePieceDraft(id, pieceId, patch);
  if (!result) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  return NextResponse.json(result);
}

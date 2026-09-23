import { NextResponse } from "next/server";
import { updatePieceDraft } from "@/lib/approval/repository";
import { PIECE_CHANNELS, PIECE_FORMATS } from "@/lib/approval/constants";
import type { PieceChannel, PieceDraftPatch, PieceFormat } from "@/lib/approval/types";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { syncPieceTask } from "@/lib/flows/automation";

export const dynamic = "force-dynamic";

const FORMAT_IDS = PIECE_FORMATS.map((f) => f.id);
const CHANNEL_IDS = PIECE_CHANNELS.map((c) => c.id);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  const session = await requireAgency();
  if (!session) return unauthorized("Faça login para editar o lote.");
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
  if (typeof body.briefing === "string") patch.briefing = body.briefing.slice(0, 4000);
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

  const result = await updatePieceDraft(session.scope, id, pieceId, patch);
  if (!result) {
    // Também é o caso de peça de outra agência — nunca 403 (ver repository).
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  // A tarefa do criativo acompanha: nome, formato, data e o briefing do designer.
  if (patch.name || patch.briefing !== undefined || patch.format || patch.date) {
    try {
      await syncPieceTask(session.scope, result.batch, result.piece);
    } catch (err) {
      console.error("[fluxos] tarefa do criativo não acompanhou a peça", pieceId, err);
    }
  }
  return NextResponse.json(result);
}

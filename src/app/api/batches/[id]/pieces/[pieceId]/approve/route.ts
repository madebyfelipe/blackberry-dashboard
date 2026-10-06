import { NextResponse } from "next/server";
import { approvePieceByAgency } from "@/lib/approval/repository";
import { onAgencyApproval } from "@/lib/flows/automation";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; pieceId: string }> },
) {
  // Aprovação da agência exige sessão — e só vale no lote da própria agência;
  // a do cliente entra por /api/approve/<token>.
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id, pieceId } = await params;
  const piece = await approvePieceByAgency(session.scope, id, pieceId);
  if (!piece) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }
  /*
   * A aprovação anda com a tarefa do criativo, pelo mesmo caminho da decisão
   * do cliente (issue #81, achado 4) — sem isto, uma peça aprovada pela
   * agência enquanto o cliente não decide fica presa na etapa de aprovação.
   */
  try {
    await onAgencyApproval(session.scope, pieceId);
  } catch (err) {
    console.error("[fluxos] aprovação da agência não chegou na tarefa", pieceId, err);
  }
  return NextResponse.json({ piece });
}

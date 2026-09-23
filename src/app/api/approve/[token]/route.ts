import { NextResponse } from "next/server";
import { decidePiece, getBatchByToken } from "@/lib/approval/repository";
import { onClientDecision, scopeOfBatch } from "@/lib/flows/automation";
import type { PieceStatus } from "@/lib/approval/types";

export const dynamic = "force-dynamic";

/*
 * Decisão do cliente pelo link público. Sem sessão, e por isso sem agência: a
 * autorização inteira é o token, que resolve um lote só. É a única rota de
 * escrita do produto que não passa por `AgencyScope` — qualquer agência que
 * viesse desta requisição seria agência escolhida por quem chama.
 */
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

  const ip = clientIp(req);
  const piece = await decidePiece(token, pieceId, decision, { reason, who, ip });
  if (piece === "inactive-link") {
    return NextResponse.json(
      { error: "Este link não está mais ativo. Peça um novo link à agência." },
      { status: 410 },
    );
  }
  if (!piece) {
    return NextResponse.json(
      { error: "Lote ou peça não encontrados." },
      { status: 404 },
    );
  }
  /*
   * A decisão anda com a tarefa do criativo: aprovado segue o fluxo, ajuste
   * volta uma etapa. O cliente já decidiu — um tropeço aqui vai para o log,
   * não para a tela dele.
   */
  try {
    const batch = await getBatchByToken(token);
    if (batch) await onClientDecision(scopeOfBatch(batch), pieceId, decision, reason);
  } catch (err) {
    console.error("[fluxos] decisão do cliente não chegou na tarefa", pieceId, err);
  }
  return NextResponse.json({ piece });
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

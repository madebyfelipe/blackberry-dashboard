import { NextResponse } from "next/server";
import { decidePiece, getBatchByToken } from "@/lib/approval/repository";
import { onClientDecision, scopeOfBatch } from "@/lib/flows/automation";
import { createAttempts } from "@/lib/auth/attempts";
import {
  parsePublicDecision,
  PUBLIC_BODY_MAX,
  PUBLIC_WRITES_MAX,
  PUBLIC_WRITES_WINDOW_MS,
  toPublicPiece,
} from "@/lib/approval/public";

export const dynamic = "force-dynamic";

/*
 * Decisão do cliente pelo link público. Sem sessão, e por isso sem agência: a
 * autorização inteira é o token, que resolve um lote só. É a única rota de
 * escrita do produto que não passa por `AgencyScope` — qualquer agência que
 * viesse desta requisição seria agência escolhida por quem chama.
 */

/*
 * Freio por token + IP (o mesmo do login, com teto de lote inteiro): cada
 * decisão grava no lote e reentra a etapa do fluxo, e sem freio dava para
 * repetir o POST sem fim (issue #77). Toda requisição conta — aqui não há
 * "acerto" que zere. Fica na memória da instância, como o do login.
 */
const writes = createAttempts(Date.now, {
  max: PUBLIC_WRITES_MAX,
  windowMs: PUBLIC_WRITES_WINDOW_MS,
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const ip = clientIp(req);
  const key = `${token}|${ip ?? "?"}`;
  // Confere e conta num passo só, antes de qualquer await (mesmo freio do login).
  const wait = writes.reserve(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Muitas decisões seguidas. Tente de novo em ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  // Corpo gigante nem é lido: o tamanho declarado já basta para recusar.
  if (Number(req.headers.get("content-length") ?? 0) > PUBLIC_BODY_MAX) {
    return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  }
  const parsed = parsePublicDecision(await req.text());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const { pieceId, decision, reason, who } = parsed.value;

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
  // Só o que a tela do cliente mostra: nada de briefing, histórico nem IP.
  return NextResponse.json({ piece: toPublicPiece(piece) });
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

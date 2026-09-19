import { NextResponse } from "next/server";
import { regenerateBatchToken, setBatchLinkRevoked } from "@/lib/approval/repository";
import { requireUser, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Action = "regenerate" | "revoke" | "reactivate";
const VALID: Action[] = ["regenerate", "revoke", "reactivate"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Gerar/revogar link é ação da agência — nunca de quem tem só o link.
  if (!(await requireUser())) return unauthorized("Faça login para gerenciar o link.");
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = String(body.action ?? "") as Action;
  if (!VALID.includes(action)) {
    return NextResponse.json({ error: "Ação inválida." }, { status: 422 });
  }

  const batch =
    action === "regenerate"
      ? await regenerateBatchToken(id)
      : await setBatchLinkRevoked(id, action === "revoke");

  if (!batch) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ batch });
}

import { NextResponse } from "next/server";
import { ValidationError, updateFlow, type FlowPatch } from "@/lib/flows/repository";
import { setFlowClients } from "@/lib/clients/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Só o que a tela edita. Quem editou e quando vêm da sessão, não do corpo. */
function pickPatch(body: unknown): FlowPatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const patch: FlowPatch = {};
  if (input.name !== undefined) patch.name = String(input.name);
  if (input.description !== undefined) patch.description = String(input.description);
  if (input.category !== undefined) patch.category = input.category as FlowPatch["category"];
  if (input.icon !== undefined) patch.icon = input.icon as FlowPatch["icon"];
  if (input.color !== undefined) patch.color = input.color as FlowPatch["color"];
  if (input.appliesTo !== undefined) patch.appliesTo = input.appliesTo as FlowPatch["appliesTo"];
  if (input.status !== undefined) patch.status = input.status as FlowPatch["status"];
  if (input.steps !== undefined) patch.steps = input.steps as FlowPatch["steps"];
  if (input.startStepId !== undefined) {
    patch.startStepId = input.startStepId ? String(input.startStepId) : null;
  }
  return patch;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  try {
    const flow = await updateFlow(session.scope, id, pickPatch(body), session.user.name);
    if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
    // "Clientes específicos" editado no passo "Detalhes": a lista inteira, de uma vez.
    const clientIds = (body as Record<string, unknown> | null)?.clientIds;
    if (Array.isArray(clientIds)) await setFlowClients(session.scope, flow.id, clientIds.map(String));
    return NextResponse.json({ flow });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

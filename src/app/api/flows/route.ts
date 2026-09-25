import { NextResponse } from "next/server";
import { ValidationError, createFlow, listFlows, type NewFlow } from "@/lib/flows/repository";
import { setFlowClients } from "@/lib/clients/repository";
import { isFlowTemplateId } from "@/lib/flows/templates";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAgency();
  if (!session) return unauthorized();
  return NextResponse.json({ flows: await listFlows(session.scope) });
}

/**
 * "Criar fluxo" / "Salvar rascunho" do Novo fluxo: o modelo, o passo
 * "Detalhes" e, em "Clientes específicos", quem entra nele. Quem criou vem
 * da sessão, não do corpo.
 */
export async function POST(req: Request) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const clientIds = Array.isArray(input.clientIds) ? input.clientIds.map(String) : [];
  try {
    const flow = await createFlow(session.scope, {
      name: String(input.name ?? ""),
      by: session.user.name,
      template: isFlowTemplateId(input.template) ? input.template : undefined,
      description: input.description === undefined ? undefined : String(input.description),
      category: input.category as NewFlow["category"],
      icon: input.icon as NewFlow["icon"],
      color: input.color as NewFlow["color"],
      appliesTo: input.appliesTo as NewFlow["appliesTo"],
      status: input.status as NewFlow["status"],
    });
    if (flow.appliesTo === "especificos" && clientIds.length > 0) {
      await setFlowClients(session.scope, flow.id, clientIds);
    }
    return NextResponse.json({ flow }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

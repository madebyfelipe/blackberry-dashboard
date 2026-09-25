import "server-only";
import { NextResponse } from "next/server";
import { requireAgency, unauthorized, type AgencySession } from "@/lib/auth/session";
import { getClient } from "@/lib/clients/repository";
import type { Client } from "@/lib/clients/types";
import { ValidationError, type ServiceInput } from "./repository";

/*
 * O começo e o fim de toda rota da ficha do cliente: sessão, cliente desta
 * agência (outro responde 404, nunca 403) e o erro de validação virando 422.
 * O corpo é lido aqui para que JSON quebrado responda 400 em todas iguais.
 */

type Handler = (ctx: {
  session: AgencySession;
  client: Client;
  body: Record<string, unknown>;
}) => Promise<Response>;

export async function withClient(
  req: Request,
  clientId: string,
  handler: Handler,
  opts: { body?: boolean } = { body: true },
): Promise<Response> {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const client = await getClient(session.scope, clientId);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  let body: Record<string, unknown> = {};
  if (opts.body) {
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
  }
  try {
    return await handler({ session, client, body });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export function notFound(message: string): Response {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Só os campos do serviço — o resto (id, mês das entregas) sai do servidor. */
export function pickService(body: Record<string, unknown>): ServiceInput {
  const out: ServiceInput = {};
  if (body.name !== undefined) out.name = String(body.name);
  if (body.kind !== undefined) out.kind = body.kind as ServiceInput["kind"];
  if (body.scope !== undefined) out.scope = String(body.scope);
  if (body.responsibleId !== undefined) out.responsibleId = body.responsibleId ? String(body.responsibleId) : null;
  if (body.monthlyValue !== undefined) out.monthlyValue = Number(body.monthlyValue);
  if (body.status !== undefined) out.status = body.status as ServiceInput["status"];
  if (body.quota !== undefined) out.quota = body.quota === null ? null : Number(body.quota);
  if (body.unit !== undefined) out.unit = String(body.unit);
  if (body.delivered !== undefined) out.delivered = Number(body.delivered);
  if (body.stage !== undefined) out.stage = String(body.stage);
  return out;
}

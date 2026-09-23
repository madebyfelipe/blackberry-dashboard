import { NextResponse } from "next/server";
import {
  deleteClient,
  updateClient,
  ValidationError,
} from "@/lib/clients/repository";
import type { ClientPatch } from "@/lib/clients/types";
import { requireAgency, unauthorized } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Só estes campos podem vir do cliente — `createdAt` e `agencyId` não. */
const EDITABLE = [
  "name",
  "segment",
  "services",
  "owner",
  "billingDay",
  "status",
  "city",
  "email",
  "phone",
  "squad",
  "flowId",
] as const;

function pickPatch(body: unknown): ClientPatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  return patch as ClientPatch;
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
    const client = await updateClient(session.scope, id, pickPatch(body));
    if (!client) {
      /*
       * Mesma resposta para "não existe" e "é de outra agência": um 403 aqui
       * confirmaria que o id existe em algum lugar.
       */
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id } = await params;
  const ok = await deleteClient(session.scope, id);
  if (!ok) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

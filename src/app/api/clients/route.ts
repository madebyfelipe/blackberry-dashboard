import { NextResponse } from "next/server";
import {
  createClient,
  listClients,
  ValidationError,
} from "@/lib/clients/repository";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/agency/repository";
import { contractFromDefaults, withClientDefaults } from "@/lib/agency/settings";
import { updateContract } from "@/lib/crm/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  // A agência sai da sessão. Não há parâmetro por onde pedir a de outra.
  const session = await requireAgency();
  if (!session) return unauthorized();
  const clients = await listClients(session.scope);
  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const session = await requireAgency();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  // O que a pessoa deixou em branco sai dos padrões da agência (Configurações › Agência).
  const defaults = (await getAgencySettings(session.scope)).clientDefaults;
  const { name, segment, services, owner, billingDay, status, city, email, phone, contactName, nps, squad, flowId } =
    withClientDefaults((body ?? {}) as Record<string, unknown>, defaults);

  try {
    const client = await createClient(session.scope, {
      name: String(name ?? ""),
      segment: segment === undefined ? undefined : String(segment),
      services: services as never,
      owner: owner === undefined ? undefined : String(owner),
      billingDay: billingDay as never,
      status: status as never,
      city: city === undefined ? undefined : String(city),
      email: email === undefined ? undefined : String(email),
      phone: phone === undefined ? undefined : String(phone),
      contactName: contactName === undefined ? undefined : String(contactName),
      nps: nps as never,
      squad: squad as never,
      flowId: flowId ? String(flowId) : null,
    });
    // Contrato e pagamento padrão já entram na ficha do cliente novo.
    const account = contractFromDefaults(defaults);
    if (account) await updateContract(session.scope, client.id, account).catch(() => undefined);
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

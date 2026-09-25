import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listFlows } from "@/lib/flows/repository";
import { listClients } from "@/lib/clients/repository";
import { FlowWizard } from "@/components/flows/FlowWizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Novo fluxo" };

/** Novo fluxo — os três passos dos exports "Novo Fluxo · 1/2/3". */
export default async function NovoFluxoPage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const [flows, clients] = await Promise.all([listFlows(session.scope), listClients(session.scope)]);
  return (
    <FlowWizard
      clients={clients.map((c) => ({ id: c.id, name: c.name, segment: c.segment, flowId: c.flowId }))}
      flows={flows.map((f) => ({ id: f.id, name: f.name }))}
    />
  );
}

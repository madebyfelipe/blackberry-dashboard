import { notFound } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { getFlow, listFlows } from "@/lib/flows/repository";
import { listClients } from "@/lib/clients/repository";
import { FlowWizard } from "@/components/flows/FlowWizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar fluxo" };

/** "Editar" do cabeçalho do fluxo: o passo "Detalhes" do Novo fluxo, com o fluxo preenchido. */
export default async function EditarFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const { id } = await params;
  const [flow, flows, clients] = await Promise.all([
    getFlow(session.scope, id),
    listFlows(session.scope),
    listClients(session.scope),
  ]);
  if (!flow) notFound();
  return (
    <FlowWizard
      flow={flow}
      clients={clients.map((c) => ({ id: c.id, name: c.name, segment: c.segment, flowId: c.flowId }))}
      flows={flows.map((f) => ({ id: f.id, name: f.name }))}
    />
  );
}

import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listFlows } from "@/lib/flows/repository";
import { listMembers } from "@/lib/inbox/repository";
import { listClients } from "@/lib/clients/repository";
import { FlowsView } from "@/components/flows/FlowsView";
import { isWorking } from "@/lib/inbox/users";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fluxos e Processos" };

export default async function FluxosPage({
  searchParams,
}: {
  searchParams: Promise<{ fluxo?: string; etapa?: string }>;
}) {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const [flows, members, clients, params] = await Promise.all([
    listFlows(session.scope),
    listMembers(session.scope),
    listClients(session.scope),
    searchParams,
  ]);
  return (
    <FlowsView
      initialFlows={flows}
      initialClients={clients.map((c) => ({ id: c.id, name: c.name, flowId: c.flowId }))}
      team={members.filter(isWorking).map((m) => ({ id: m.id, name: m.name, handle: m.handle }))}
      initialFlowId={params.fluxo ?? null}
      initialStepId={params.etapa ?? null}
    />
  );
}

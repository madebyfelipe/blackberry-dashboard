import { redirect } from "next/navigation";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listFlows } from "@/lib/flows/repository";
import { listMembers } from "@/lib/inbox/repository";
import { FlowsView } from "@/components/flows/FlowsView";
import { isWorking } from "@/lib/inbox/users";

export const dynamic = "force-dynamic";

export default async function FluxosPage({
  searchParams,
}: {
  searchParams: Promise<{ fluxo?: string; etapa?: string }>;
}) {
  const session = await currentInboxSession();
  if (!session) redirect("/login");
  const [flows, members, params] = await Promise.all([
    listFlows(session.scope),
    listMembers(session.scope),
    searchParams,
  ]);
  return (
    <FlowsView
      initialFlows={flows}
      team={members.filter(isWorking).map((m) => ({ id: m.id, name: m.name, handle: m.handle }))}
      initialFlowId={params.fluxo ?? null}
      initialStepId={params.etapa ?? null}
    />
  );
}

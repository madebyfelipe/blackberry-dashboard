import { redirect } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/agency/repository";
import { integrationStatus } from "@/lib/agency/integrations";
import { listFlows } from "@/lib/flows/repository";
import { getTeamSettings, listMembers } from "@/lib/inbox/repository";
import { canManageTeam, canSeeDashboard, isAdmin, isWorking } from "@/lib/inbox/users";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { AgencySettingsView } from "@/components/settings/AgencySettingsView";
import type { SettingsTab } from "@/components/settings/kit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações · Agência" };

/** Configurações › Agência — só Admin e Gerente; o resto volta para a Pessoal. */
export default async function AgenciaPage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  if (!canManageTeam(session.me)) redirect("/configuracoes");

  const [settings, team, members, flows] = await Promise.all([
    getAgencySettings(session.scope),
    getTeamSettings(session.scope),
    listMembers(session.scope),
    listFlows(session.scope),
  ]);
  const tabs: SettingsTab[] = ["agencia", ...(canSeeDashboard(session.me) ? (["painel"] as const) : [])];

  return (
    <AgencySettingsView
      tabs={tabs}
      name={session.scope.agencyName}
      settings={settings}
      team={team}
      viewerEmail={session.me.email}
      canDelete={isAdmin(session.me)}
      counts={{
        members: members.filter(isWorking).length,
        invites: members.filter((m) => m.status === "convite" && !m.joinRequest).length,
        activeFlows: flows.filter((f) => f.status === "ativo").length,
        draftFlows: flows.filter((f) => f.status === "rascunho").length,
      }}
      flows={flows
        .filter((f) => f.status === "ativo" || f.status === "rascunho")
        .map((f) => ({ id: f.id, name: f.name }))}
      integrations={integrationStatus()}
    />
  );
}

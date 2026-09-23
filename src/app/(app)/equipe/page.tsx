import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { getTeamSettings, listMembers } from "@/lib/inbox/repository";
import { canManageTeam } from "@/lib/inbox/users";
import { toUserRow } from "@/lib/team/rows";
import { UsersView } from "@/components/team/UsersView";

export const dynamic = "force-dynamic";

/** Usuários — export "Usuários · Painel (Lista)". O time da agência. */
export default async function EquipePage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const [members, settings] = await Promise.all([listMembers(session.scope), getTeamSettings(session.scope)]);
  return (
    <UsersView
      initialUsers={members.map((m) => toUserRow(m, session.me))}
      meId={session.me.id}
      canManage={canManageTeam(session.me)}
      initialSettings={settings}
      myEmail={session.me.email}
    />
  );
}

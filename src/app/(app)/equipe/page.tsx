import { redirect } from "next/navigation";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listMembers } from "@/lib/inbox/repository";
import { canManageTeam } from "@/lib/inbox/users";
import { toUserRow } from "@/lib/team/rows";
import { UsersView } from "@/components/team/UsersView";

export const dynamic = "force-dynamic";

/** Usuários — export "Usuários · Painel (Lista)". O time da agência. */
export default async function EquipePage() {
  const session = await currentInboxSession();
  if (!session) redirect("/login");
  const members = await listMembers(session.scope);
  return (
    <UsersView
      initialUsers={members.map((m) => toUserRow(m, session.me))}
      meId={session.me.id}
      canManage={canManageTeam(session.me)}
    />
  );
}

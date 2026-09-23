import { redirect } from "next/navigation";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await currentInboxSession();
  if (!session) redirect("/login");
  return <SettingsView user={session.user} handle={session.me.handle} />;
}

import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  return <SettingsView user={session.user} handle={session.me.handle} />;
}

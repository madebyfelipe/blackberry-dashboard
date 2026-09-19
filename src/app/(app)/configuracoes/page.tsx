import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <SettingsView user={user} />;
}

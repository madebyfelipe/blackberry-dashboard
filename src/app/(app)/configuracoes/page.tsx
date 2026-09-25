import { headers } from "next/headers";
import { redirectWithoutScope } from "@/lib/auth/session";
import { cityLabel } from "@/lib/auth/device";
import { listConversations } from "@/lib/inbox/repository";
import { canManageTeam, canSeeDashboard } from "@/lib/inbox/users";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { PersonalSettings } from "@/components/settings/PersonalSettings";
import type { SettingsTab } from "@/components/settings/kit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configurações" };

/** Configurações › Pessoal — a aba que todo mundo vê. */
export default async function ConfiguracoesPage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const [conversations, h] = await Promise.all([
    listConversations(session.scope, session.me.id),
    headers(),
  ]);
  const tabs: SettingsTab[] = [
    ...(canManageTeam(session.me) ? (["agencia"] as const) : []),
    ...(canSeeDashboard(session.me) ? (["painel"] as const) : []),
  ];
  return (
    <PersonalSettings
      user={session.user}
      me={session.me}
      tabs={tabs}
      muted={conversations
        .filter((c) => c.muted)
        .map((c) => ({ id: c.id, kind: c.kind, title: c.title }))}
      city={cityLabel(h.get("x-vercel-ip-city"), h.get("x-vercel-ip-country-region"))}
    />
  );
}

import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listNotifications } from "@/lib/notifications/repository";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notificações" };

/**
 * Notificações — o que aconteceu com você: menções (briefing, comentário,
 * mensagem), tarefas que chegaram para você e mensagens novas. Só as suas: o
 * destinatário sai da sessão.
 */
export default async function NotificacoesPage() {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const notifications = await listNotifications(session.scope, session.me.id);
  return <NotificationsView initial={notifications} />;
}

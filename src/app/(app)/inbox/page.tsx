import { redirectWithoutScope } from "@/lib/auth/session";
import { InboxView } from "@/components/inbox/InboxView";
import { ablyReady } from "@/lib/realtime/server";
import {
  getConversation,
  listConversations,
  listMembers,
} from "@/lib/inbox/repository";
import { sortSummaries } from "@/lib/inbox/view";
import { currentInboxSession } from "@/lib/inbox/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inbox" };

/**
 * Inbox — a conversa do time (issue #30).
 *
 * A tela abre já com a conversa mais recente carregada, como o desenho mostra;
 * no celular ela começa na lista, e a conversa entra por cima quando alguém
 * toca numa linha.
 *
 * Nada aqui é lido sem escopo: quem está olhando sai da sessão do servidor, e
 * é ele que define quais conversas existem (as da agência dele em que ele
 * está dentro).
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();

  const [members, conversations] = await Promise.all([
    listMembers(session.scope),
    listConversations(session.scope, session.me.id),
  ]);

  // `?conversa=` é o clique numa notificação: abre aquela conversa.
  const { conversa } = await searchParams;
  const wanted = conversa ? conversations.find((c) => c.id === conversa) : undefined;
  const first = wanted ?? sortSummaries(conversations)[0];
  const initial = first
    ? await getConversation(session.scope, session.me.id, first.id)
    : undefined;

  return (
    <InboxView
      snapshot={{ me: session.me, members, conversations }}
      initialConversation={initial ?? null}
      live={await ablyReady()}
      blobUploads={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
    />
  );
}

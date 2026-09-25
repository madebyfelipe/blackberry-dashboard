import { notFound } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { foldName, getClient } from "@/lib/clients/repository";
import { getAccount } from "@/lib/crm/repository";
import { listTasksForClient } from "@/lib/tasks/repository";
import { listBatches } from "@/lib/approval/repository";
import { slugify } from "@/lib/approval/clients";
import { listConversations, listMembers } from "@/lib/inbox/repository";
import { isWorking } from "@/lib/inbox/users";
import { ClientDetail } from "@/components/crm/ClientDetail";
import { isDetailTab } from "@/components/crm/tabs";
import type { CreativeFile } from "@/components/crm/FilesTab";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentInboxSession();
  const { id } = await params;
  const client = session ? await getClient(session.scope, id) : undefined;
  return { title: client?.name ?? "Cliente" };
}

/**
 * Ficha do cliente (export "Clientes · Detalhe"). Reúne o que já existe sobre
 * ele — a ficha de `lib/crm`, as tarefas e os lotes — e entrega à tela; a
 * linha do tempo e os números saem das funções puras de `lib/crm/view.ts`.
 */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const [{ id }, { aba }] = await Promise.all([params, searchParams]);
  const client = await getClient(session.scope, id);
  // Cliente de outra agência cai no mesmo 404 de um que não existe.
  if (!client) notFound();

  const [account, tasks, batches, members, conversations] = await Promise.all([
    getAccount(session.scope, id),
    listTasksForClient(session.scope, id),
    listBatches(session.scope),
    listMembers(session.scope),
    listConversations(session.scope, session.me.id),
  ]);

  // O lote ainda guarda o cliente como texto: vale o vínculo ou o nome dobrado.
  const key = foldName(client.name);
  const mine = batches.filter((b) => b.clientId === id || (!b.clientId && foldName(b.client) === key));
  const slug = slugify(client.name);

  const creatives: CreativeFile[] = mine.flatMap((b) =>
    b.pieces.flatMap((p) =>
      (p.media ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        mime: m.mime,
        size: m.size,
        createdAt: m.createdAt,
        url: m.url,
        batchLabel: b.label,
        batchHref: `/social/${slug}/${b.id}`,
      })),
    ),
  );

  // A conversa do time sobre o cliente (grupo com o nome dele no Inbox), se existir.
  const conversation = conversations.find((c) => c.kind === "grupo" && foldName(c.title) === key);

  return (
    <ClientDetail
      client={client}
      account={account}
      team={members.filter(isWorking).map((m) => ({ id: m.id, name: m.name, handle: m.handle, role: m.role }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        comments: t.comments,
      }))}
      batches={mine.map((b) => ({
        id: b.id,
        label: b.label,
        pieces: b.pieces.map((p) => ({ id: p.id, name: p.name, reason: p.reason, history: p.history })),
      }))}
      creatives={creatives}
      conversationId={conversation?.id ?? null}
      projectsHref={`/social/${slug}`}
      blobUploads={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
      initialTab={isDetailTab(aba) ? aba : "visao"}
    />
  );
}

import "server-only";
import type { AgencyScope } from "@/lib/agency/types";
import { listMembers } from "@/lib/inbox/repository";
import { publishToMembers } from "@/lib/realtime/server";
import { pushNotifications } from "./repository";
import {
  commentNotifications,
  messageNotifications,
  taskNotifications,
  type Actor,
} from "./rules";
import type { NotificationInput } from "./types";

/*
 * A entrega das notificações: grava (`repository.ts`) e empurra pelo canal
 * pessoal de cada um (`realtime/server.ts`), onde o notificador do shell
 * mostra o aviso do sistema e a lateral atualiza o número.
 *
 * Tudo aqui é **melhor esforço**: quem chama já gravou a tarefa, o
 * comentário ou a mensagem, e uma falha em avisar não pode desfazer nem
 * derrubar isso. Falhou, fica no log.
 */

async function deliver(scope: AgencyScope, inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const saved = await pushNotifications(scope, inputs);
  await Promise.all(
    saved.map((n) =>
      publishToMembers(scope, [n.recipientId], {
        tipo: "notificacao",
        notification: {
          id: n.id,
          kind: n.kind,
          title: n.title,
          body: n.body,
          href: n.href,
          ref: n.ref,
          actor: n.actor,
        },
      }),
    ),
  );
}

async function safely(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error(`[notificacoes] ${what} falhou`, err);
  }
}

type TaskLike = Parameters<typeof taskNotifications>[3];

export function notifyTaskChange(
  scope: AgencyScope,
  actor: Actor,
  before: TaskLike | undefined,
  after: TaskLike,
  why?: string,
): Promise<void> {
  return safely("aviso da tarefa", async () => {
    const team = await listMembers(scope);
    await deliver(scope, taskNotifications(team, actor, before, after, why));
  });
}

export function notifyTaskComment(
  scope: AgencyScope,
  actor: Actor,
  task: TaskLike,
  text: string,
): Promise<void> {
  return safely("aviso do comentário", async () => {
    const team = await listMembers(scope);
    await deliver(scope, commentNotifications(team, actor, task, text));
  });
}

export function notifyMessage(
  scope: AgencyScope,
  actor: Actor,
  conversation: Parameters<typeof messageNotifications>[2],
  text: string,
  messageId?: string,
): Promise<void> {
  return safely("aviso da mensagem", async () => {
    const team = await listMembers(scope);
    await deliver(scope, messageNotifications(team, actor, conversation, text, messageId));
  });
}

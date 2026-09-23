import { notFound } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { markNotifications } from "@/lib/notifications/repository";
import { getTask } from "@/lib/tasks/repository";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { getFlow } from "@/lib/flows/repository";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tarefa" };

type Ctx = { params: Promise<{ id: string }> };

export default async function TarefaPage({ params }: Ctx) {
  // O layout já barra quem não tem sessão; sem escopo não há o que buscar.
  const session = await currentInboxSession();
  if (!session) return redirectWithoutScope();
  const { scope } = session;

  const { id } = await params;
  /*
   * `getTask` procura por id *e* agência: tarefa de outra agência cai no
   * mesmo 404 de tarefa inexistente, como nas rotas de API.
   */
  const task = await getTask(scope, id);
  if (!task) notFound();

  // Abrir a tarefa é ler os avisos dela (atribuição, menção, comentário).
  await markNotifications(scope, session.me.id, { ref: `tarefa:${task.id}` });

  // O fluxo da tarefa, para a tela oferecer "mover para a próxima etapa".
  const flow = task.flowId ? await getFlow(scope, task.flowId) : undefined;

  return <TaskDetail task={task} flow={flow ?? null} />;
}

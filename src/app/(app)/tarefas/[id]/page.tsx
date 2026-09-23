import { notFound } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { getTask } from "@/lib/tasks/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { getFlow } from "@/lib/flows/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export default async function TarefaPage({ params }: Ctx) {
  // O layout já barra quem não tem sessão; sem escopo não há o que buscar.
  const scope = await currentAgencyScope();
  if (!scope) return redirectWithoutScope();

  const { id } = await params;
  /*
   * `getTask` procura por id *e* agência: tarefa de outra agência cai no
   * mesmo 404 de tarefa inexistente, como nas rotas de API.
   */
  const task = await getTask(scope, id);
  if (!task) notFound();

  // O fluxo da tarefa, para a tela oferecer "mover para a próxima etapa".
  const flow = task.flowId ? await getFlow(scope, task.flowId) : undefined;

  return <TaskDetail task={task} flow={flow ?? null} />;
}

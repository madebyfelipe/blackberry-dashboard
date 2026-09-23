import { listTasks } from "@/lib/tasks/repository";
import { currentAgencyScope, currentUser, redirectWithoutScope } from "@/lib/auth/session";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tarefas" };

export default async function TarefasPage() {
  // A tela lê só as tarefas da agência da sessão. O layout já barra quem não
  // tem sessão; este redirect existe porque sem escopo não há o que listar.
  const scope = await currentAgencyScope();
  if (!scope) return redirectWithoutScope();
  const [tasks, user] = await Promise.all([listTasks(scope), currentUser()]);
  return <TasksView initialTasks={tasks} me={user?.name ?? ""} />;
}

import { listTasks } from "@/lib/tasks/repository";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const tasks = await listTasks();
  return <TasksView initialTasks={tasks} />;
}

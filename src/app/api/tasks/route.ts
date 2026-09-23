import { NextResponse } from "next/server";
import { createTask, listTasks, ValidationError } from "@/lib/tasks/repository";
import { unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { enterClientFlow } from "@/lib/flows/automation";
import { notifyTaskChange } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

export async function GET() {
  // A agência sai da sessão. Não há parâmetro por onde pedir a de outra.
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const tasks = await listTasks(session.scope);
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  // O criador e a agência vêm da sessão, nunca do corpo da requisição.
  const session = await currentInboxSession();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const {
    title,
    client,
    status,
    assignee,
    description,
    priority,
    labels,
    dueDate,
  } = (body ?? {}) as Record<string, unknown>;

  try {
    const created = await createTask(session.scope, {
      title: String(title ?? ""),
      client: String(client ?? ""),
      status: status as never,
      assignee: assignee === undefined ? undefined : String(assignee),
      description: description === undefined ? undefined : String(description),
      priority: priority as never,
      labels: labels as never,
      creator: session.user.name,
      dueDate: dueDate as never,
    });
    /*
     * Cliente com fluxo atribuído (Fluxos e Processos → Clientes): a tarefa
     * já nasce na primeira etapa dele, com quem toca essa etapa — a não ser
     * que quem criou tenha escolhido o responsável na mão.
     */
    const task =
      (await enterClientFlow(session.scope, created, {
        by: session.user.name,
        keepAssignee: typeof assignee === "string" && assignee.trim() !== "",
      })) ?? created;
    await notifyTaskChange(session.scope, { id: session.me.id, name: session.me.name }, undefined, task);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

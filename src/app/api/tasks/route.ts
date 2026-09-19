import { NextResponse } from "next/server";
import { createTask, listTasks, ValidationError } from "@/lib/tasks/repository";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
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

  // O criador vem da sessão, nunca do corpo da requisição.
  const user = await currentUser();

  try {
    const task = await createTask({
      title: String(title ?? ""),
      client: String(client ?? ""),
      status: status as never,
      assignee: assignee === undefined ? undefined : String(assignee),
      description: description === undefined ? undefined : String(description),
      priority: priority as never,
      labels: labels as never,
      creator: user?.name,
      dueDate: dueDate as never,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

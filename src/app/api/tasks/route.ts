import { NextResponse } from "next/server";
import { createTask, listTasks, ValidationError } from "@/lib/tasks/repository";

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
  const { title, client, status, assignee } = (body ?? {}) as Record<
    string,
    unknown
  >;
  try {
    const task = await createTask({
      title: String(title ?? ""),
      client: String(client ?? ""),
      status: status as never,
      assignee: assignee === undefined ? undefined : String(assignee),
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

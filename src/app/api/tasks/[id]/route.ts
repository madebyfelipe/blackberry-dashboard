import { NextResponse } from "next/server";
import {
  deleteTask,
  updateTask,
  ValidationError,
} from "@/lib/tasks/repository";
import type { TaskPatch } from "@/lib/tasks/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Só estes campos podem vir do cliente — `creator` e `createdAt` não. */
const EDITABLE = [
  "title",
  "client",
  "status",
  "assignee",
  "description",
  "priority",
  "labels",
  "dueDate",
] as const;

function pickPatch(body: unknown): TaskPatch {
  const input = (body ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  return patch as TaskPatch;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  try {
    const task = await updateTask(id, pickPatch(body));
    if (!task) {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = await deleteTask(id);
  if (!ok) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

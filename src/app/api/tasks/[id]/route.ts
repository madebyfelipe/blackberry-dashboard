import { NextResponse } from "next/server";
import {
  deleteTask,
  getTask,
  updateTask,
  ValidationError,
} from "@/lib/tasks/repository";
import type { TaskPatch } from "@/lib/tasks/types";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { notifyTaskChange } from "@/lib/notifications/dispatch";
import { advanceTask } from "@/lib/flows/automation";

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
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  try {
    const patch = pickPatch(body);
    // Só uma passagem de verdade para "concluído" anda a etapa: repetir o
    // status (clique duplo, dois abertos) não pode pular etapa nem duplicar nota.
    const before = await getTask(session.scope, id);
    const task = await updateTask(session.scope, id, patch);
    if (!task) {
      /*
       * Mesma resposta para "não existe" e "é de outra agência": um 403 aqui
       * confirmaria que o id existe em algum lugar.
       */
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }
    /*
     * Concluir uma tarefa de fluxo é concluir a etapa: ela vai para a próxima,
     * com quem toca essa etapa. A resposta já traz a tarefa como ficou, para
     * a tela não mostrar "concluída" algo que acabou de ir para outra pessoa.
     */
    if (patch.status === "concluido" && before && before.status !== "concluido") {
      // Quem recebe a próxima etapa é avisado pelo próprio motor do fluxo.
      const advanced = await advanceTask(session.scope, id, session.user.name);
      if (advanced) return NextResponse.json({ task: advanced });
    }
    // Responsável novo e quem foi marcado agora no briefing.
    await notifyTaskChange(session.scope, { id: session.me.id, name: session.me.name }, before, task);
    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id } = await params;
  const ok = await deleteTask(session.scope, id);
  if (!ok) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { read, transaction } from "./store";
import { isTaskStatus } from "./constants";
import { isTaskPriority } from "./priority";
import type { AgencyScope } from "@/lib/agency/types";
import { memberByHandle } from "@/lib/inbox/repository";
import { resolveClientId } from "@/lib/clients/repository";
import type { NewTask, Task, TaskComment, TaskPatch } from "./types";

/*
 * Everything in the app reads/writes tasks through this module.
 *
 * É aqui que o multi-tenant acontece. Toda função exige o `AgencyScope` como
 * primeiro argumento, e o escopo só nasce da sessão do servidor
 * (`auth/session.ts`) — o TypeScript recusa "listar tarefas" sem dizer de qual
 * agência, em vez de depender de alguém lembrar de filtrar.
 *
 * Vale tanto para leitura quanto para escrita: buscar por id e alterar sem
 * conferir o dono é o furo clássico, então `getTask`, `updateTask` e
 * `deleteTask` procuram por id *e* agência. Tarefa de outra agência responde
 * como tarefa inexistente (404), nunca 403 — 403 confirmaria que o id existe.
 *
 * Quando o Postgres entrar (issue #11), este filtro vira o `WHERE agency_id`
 * de cada consulta e ganha RLS por cima; o desenho já está no formato certo
 * para isso.
 */

export async function listTasks(scope: AgencyScope): Promise<Task[]> {
  const tasks = await read();
  return tasks
    .filter((t) => t.agencyId === scope.agencyId)
    // Newest first by creation date.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** As tarefas ligadas a um cliente cadastrado — para a ficha e o Health Score. */
export async function listTasksForClient(
  scope: AgencyScope,
  clientId: string,
): Promise<Task[]> {
  return (await listTasks(scope)).filter((t) => t.clientId === clientId);
}

export async function getTask(
  scope: AgencyScope,
  id: string,
): Promise<Task | undefined> {
  return (await read()).find(
    (t) => t.id === id && t.agencyId === scope.agencyId,
  );
}

function makeId(): string {
  return "t" + Math.random().toString(36).slice(2, 9);
}

/** Etiquetas: sem "#", sem espaço, sem repetição, no máximo 8. */
function cleanLabels(input: unknown): string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,]+/)
      : [];
  const out: string[] = [];
  for (const raw of list) {
    const label = String(raw).trim().replace(/^#/, "").slice(0, 24);
    if (label && !out.includes(label)) out.push(label);
    if (out.length === 8) break;
  }
  return out;
}

/**
 * O responsável pode vir pelo @ (`@marina`): vira o nome de quem atende por
 * ele na agência. @ de ninguém é erro — atribuir a um @ inexistente deixaria a
 * tarefa sem dono sem ninguém perceber. Sem @, segue texto livre como sempre.
 */
async function resolveAssignee(
  scope: AgencyScope,
  raw: string | undefined,
): Promise<string | undefined> {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (!value.startsWith("@")) return value;
  const member = await memberByHandle(scope, value);
  if (!member) throw new ValidationError(`Ninguém do time atende por ${value}.`);
  return member.name;
}

/** Prazo: ISO válido ou `null`. Data inválida é erro, não silêncio. */
function cleanDueDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ValidationError("Prazo inválido.");
  return d.toISOString();
}

export async function createTask(
  scope: AgencyScope,
  input: NewTask,
): Promise<Task> {
  const title = input.title?.trim();
  if (!title) throw new ValidationError("Título é obrigatório.");
  const client = (input.client ?? "").trim();
  const clientId = await resolveClientId(scope, client);
  const status = isTaskStatus(input.status) ? input.status : "a-fazer";
  const assignee = ((await resolveAssignee(scope, input.assignee)) ?? "").trim() || "—";
  const priority = isTaskPriority(input.priority) ? input.priority : "sem";

  const task: Task = {
    id: makeId(),
    // Dona é a agência da sessão. `NewTask` nem tem o campo, para não haver
    // onde um corpo de requisição pedir outra.
    agencyId: scope.agencyId,
    title,
    client,
    clientId,
    status,
    assignee,
    createdAt: new Date().toISOString(),
    description: (input.description ?? "").trim(),
    priority,
    labels: cleanLabels(input.labels),
    creator: (input.creator ?? "").trim() || "—",
    dueDate: cleanDueDate(input.dueDate),
    completedAt: status === "concluido" ? new Date().toISOString() : null,
    comments: [],
    flowId: input.flowId ?? null,
    stepId: input.stepId ?? null,
    source: input.source ?? null,
  };
  return transaction((tasks) => {
    tasks.unshift(task);
    return task;
  });
}

export async function updateTask(
  scope: AgencyScope,
  id: string,
  patch: TaskPatch,
): Promise<Task | undefined> {
  return (await updateTaskAtStep(scope, id, patch))?.task;
}

/**
 * `updateTask` para quem conclui pela tela: diz se **esta** gravação levou a
 * tarefa para "Concluído" (`completedNow`) — é isso que autoriza o fluxo a
 * andar uma etapa. A resposta sai de dentro da transação, então duas
 * conclusões simultâneas (clique duplo, duas abas) não podem as duas dizer sim.
 *
 * `expectStepId` é a etapa em que quem pediu viu a tarefa. Se ela já andou
 * (outra conclusão chegou antes), a troca de status é ignorada: concluir
 * "Briefing" não pode virar concluir "Redação", que ninguém nem abriu.
 */
export async function updateTaskAtStep(
  scope: AgencyScope,
  id: string,
  patch: TaskPatch,
  opts: { expectStepId?: string | null } = {},
): Promise<{ task: Task; completedNow: boolean } | undefined> {
  if (patch.status !== undefined && !isTaskStatus(patch.status)) {
    throw new ValidationError("Status inválido.");
  }
  if (patch.priority !== undefined && !isTaskPriority(patch.priority)) {
    throw new ValidationError("Prioridade inválida.");
  }
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new ValidationError("Título não pode ficar vazio.");
  }
  const assignee = await resolveAssignee(scope, patch.assignee);
  // Valida o prazo antes de abrir a transação.
  const dueDate =
    patch.dueDate === undefined ? undefined : cleanDueDate(patch.dueDate);
  // Resolvido fora da transação, como o assignee: precisa de outra leitura
  // (a lista de clientes), e a transação só pode mexer no que já tem em mãos.
  const clientId =
    patch.client === undefined
      ? undefined
      : await resolveClientId(scope, patch.client.trim());

  return transaction((tasks) => {
    const t = tasks.find(
      (x) => x.id === id && x.agencyId === scope.agencyId,
    );
    if (!t) return undefined;
    if (patch.title !== undefined) t.title = patch.title.trim();
    if (patch.client !== undefined) t.client = patch.client.trim();
    if (clientId !== undefined) t.clientId = clientId;
    const stale =
      opts.expectStepId !== undefined && (t.stepId ?? null) !== opts.expectStepId;
    let completedNow = false;
    if (patch.status !== undefined && !stale) {
      completedNow = patch.status === "concluido" && t.status !== "concluido";
      t.completedAt = completedAtFor(t, patch.status);
      t.status = patch.status;
    }
    if (assignee !== undefined) t.assignee = assignee || "—";
    if (patch.description !== undefined) t.description = patch.description.trim();
    if (patch.priority !== undefined) t.priority = patch.priority;
    if (patch.labels !== undefined) t.labels = cleanLabels(patch.labels);
    if (patch.creator !== undefined) t.creator = patch.creator.trim() || "—";
    if (dueDate !== undefined) t.dueDate = dueDate;
    return { task: { ...t, labels: [...t.labels], comments: [...t.comments] }, completedNow };
  });
}

/**
 * A data de conclusão depois de uma troca de status: nasce quando a tarefa
 * entra em "Concluído", fica enquanto ela continua lá e some quando sai.
 */
function completedAtFor(t: Task, next: Task["status"]): string | null {
  if (next !== "concluido") return null;
  return t.status === "concluido" && t.completedAt ? t.completedAt : new Date().toISOString();
}

/** Limite do que cabe num comentário da tela de descrição. */
const COMMENT_MAX = 2000;

/**
 * Acrescenta um comentário à tarefa. O autor vem de quem chama (a sessão do
 * servidor), nunca do corpo da requisição — mesma regra do `creator`.
 */
export async function addTaskComment(
  scope: AgencyScope,
  id: string,
  input: { author: string; text: string },
): Promise<Task | undefined> {
  const text = (input.text ?? "").trim();
  if (!text) throw new ValidationError("Comentário vazio.");
  if (text.length > COMMENT_MAX) {
    throw new ValidationError("Comentário longo demais.");
  }
  const comment: TaskComment = {
    id: "c" + Math.random().toString(36).slice(2, 9),
    author: (input.author ?? "").trim() || "—",
    text,
    createdAt: new Date().toISOString(),
  };

  return transaction((tasks) => {
    const t = tasks.find((x) => x.id === id && x.agencyId === scope.agencyId);
    if (!t) return undefined;
    t.comments.push(comment);
    return { ...t, labels: [...t.labels], comments: [...t.comments] };
  });
}

/**
 * Leva a tarefa para uma etapa do fluxo — quem chama é o motor dos fluxos
 * (`lib/flows/automation.ts`), nunca um PATCH: a etapa só muda porque uma
 * etapa foi concluída, e é o fluxo que diz qual vem depois e de quem ela é.
 */
export async function moveTaskToStep(
  scope: AgencyScope,
  id: string,
  move: {
    flowId: string;
    stepId: string;
    status: Task["status"];
    assignee?: string;
    dueDate: string | null;
    note: { author: string; text: string };
    /**
     * Onde o motor leu a tarefa antes de decidir o movimento. Se ela já não
     * está lá (outra conclusão, a decisão do cliente), nada é gravado: o
     * movimento foi decidido em cima de um retrato velho.
     */
    expect?: { stepId: string; status?: Task["status"] };
  },
): Promise<Task | undefined> {
  return transaction((tasks) => {
    const t = tasks.find((x) => x.id === id && x.agencyId === scope.agencyId);
    if (!t) return undefined;
    if (move.expect) {
      if (t.stepId !== move.expect.stepId) return undefined;
      if (move.expect.status !== undefined && t.status !== move.expect.status) return undefined;
    }
    t.flowId = move.flowId;
    t.stepId = move.stepId;
    t.completedAt = completedAtFor(t, move.status);
    t.status = move.status;
    if (move.assignee) t.assignee = move.assignee;
    t.dueDate = move.dueDate;
    t.comments.push({
      id: "c" + Math.random().toString(36).slice(2, 9),
      author: move.note.author,
      text: move.note.text.slice(0, COMMENT_MAX),
      createdAt: new Date().toISOString(),
    });
    return { ...t, labels: [...t.labels], comments: [...t.comments] };
  });
}

/** A tarefa que nasceu de um criativo — para a decisão do cliente chegar nela. */
export async function findTaskBySource(
  scope: AgencyScope,
  pieceId: string,
): Promise<Task | undefined> {
  return (await read()).find(
    (t) => t.agencyId === scope.agencyId && t.source?.pieceId === pieceId,
  );
}

export async function deleteTask(
  scope: AgencyScope,
  id: string,
): Promise<boolean> {
  return transaction((tasks) => {
    const i = tasks.findIndex(
      (x) => x.id === id && x.agencyId === scope.agencyId,
    );
    if (i === -1) return false;
    tasks.splice(i, 1);
    return true;
  });
}

export class ValidationError extends Error {}

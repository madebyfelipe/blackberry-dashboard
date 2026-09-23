import "server-only";
import type { AgencyScope } from "@/lib/agency/types";
import type { Batch, Piece } from "@/lib/approval/types";
import { findClientByName } from "@/lib/clients/repository";
import { notifyTaskChange } from "@/lib/notifications/dispatch";
import { listMembers } from "@/lib/inbox/repository";
import type { InboxMember } from "@/lib/inbox/types";
import { isWorking } from "@/lib/inbox/users";
import {
  addTaskComment,
  createTask,
  findTaskBySource,
  getTask,
  moveTaskToStep,
  updateTask,
} from "@/lib/tasks/repository";
import type { Task } from "@/lib/tasks/types";
import { flowForClient, getFlow } from "./repository";
import type { Flow, FlowStep } from "./types";
import { addBusinessDays, assigneeFor, nextStep, startStep } from "./view";

/*
 * O motor dos fluxos: onde criativo vira tarefa e tarefa anda de etapa.
 *
 * Fica fora dos repositórios de propósito — ele costura quatro áreas
 * (lote, cliente, time e tarefa), e cada repositório continua falando só com
 * o próprio store. As regras de "qual etapa vem depois" e "quem recebe" são
 * as funções puras de `view.ts`; aqui é só a ordem das gravações.
 *
 * As mensagens que ficam na conversa da tarefa são assinadas "black berry":
 * foi o fluxo que moveu a tarefa, não uma pessoa — e é esse registro que
 * responde "por que esta tarefa está comigo?".
 */

const SYSTEM = "black berry";

type Ctx = {
  team: InboxMember[];
  squad: string[];
  /** O responsável da ficha do cliente — a última palavra quando o fluxo não resolve. */
  owner: string | null;
};

async function contextFor(scope: AgencyScope, clientName: string): Promise<Ctx & { flowId: string | null }> {
  const [client, team] = await Promise.all([
    findClientByName(scope, clientName),
    listMembers(scope),
  ]);
  return {
    // Inativo e arquivado continuam no squad gravado, mas não recebem tarefa.
    team: team.filter(isWorking),
    squad: client?.squad ?? [],
    owner: client && client.owner !== "—" ? client.owner : null,
    flowId: client?.flowId ?? null,
  };
}

/** Quem recebe a etapa, como membro — e o nome a gravar na tarefa. */
function receiver(step: FlowStep, ctx: Ctx): { member?: InboxMember; name: string | null } {
  const id = assigneeFor(step.assignee, ctx.squad, ctx.team);
  const member = id ? ctx.team.find((m) => m.id === id) : undefined;
  return { member, name: member?.name ?? ctx.owner };
}

function dueFor(step: FlowStep): string | null {
  return step.slaDays ? addBusinessDays(new Date(), step.slaDays).toISOString() : null;
}

function who(member: InboxMember | undefined, fallback: string | null): string {
  if (member) return `@${member.handle}`;
  return fallback ?? "ninguém (defina o squad do cliente)";
}

/**
 * Um criativo novo no lote vira tarefa, já no fluxo do cliente e com quem
 * toca a primeira etapa. Sem fluxo ativo na agência, a tarefa nasce solta,
 * com o squad (ou o responsável da ficha) — mas nasce: criativo sem tarefa
 * é trabalho que ninguém vê.
 */
export async function taskForPiece(
  scope: AgencyScope,
  batch: Batch,
  piece: Piece,
  creator: string,
): Promise<Task> {
  const ctx = await contextFor(scope, batch.client);
  const flow = await flowForClient(scope, ctx.flowId);
  const step = flow ? startStep(flow) : null;

  let assignee: string | null;
  let member: InboxMember | undefined;
  if (step) {
    ({ member, name: assignee } = receiver(step, ctx));
  } else {
    member = ctx.team.find((m) => ctx.squad.includes(m.id));
    assignee = member?.name ?? ctx.owner;
  }

  const task = await createTask(scope, {
    title: pieceTaskTitle(batch, piece),
    client: batch.client,
    status: "a-fazer",
    assignee: assignee ?? undefined,
    creator,
    labels: ["criativo"],
    description: pieceTaskDescription(batch, piece),
    // O prazo do criativo é o dia planejado para ele, não o prazo da etapa.
    dueDate: plannedDate(piece),
    flowId: flow && step ? flow.id : null,
    stepId: step?.id ?? null,
    source: { batchId: batch.id, pieceId: piece.id },
  });

  const onde = flow && step ? `Entrou no fluxo ${flow.name}, etapa ${step.name}` : "Sem fluxo ativo na agência";
  const saved = (await noteOnly(scope, task, `${onde} — com ${who(member, assignee)}.`)) ?? task;
  await notifyTaskChange(scope, { name: SYSTEM }, undefined, saved, onde);
  return saved;
}

/**
 * Uma tarefa criada na mão para um cliente **com fluxo atribuído** (Fluxos e
 * Processos → Clientes do fluxo) já nasce na primeira etapa dele: com quem
 * toca a etapa e o prazo dela. Quem escolheu o responsável na mão continua
 * com ele — o fluxo assume dali para a frente, quando a etapa for concluída.
 *
 * Só o fluxo escolhido na ficha vale aqui (não o "primeiro ativo da
 * agência", como no criativo): tarefa avulsa de cliente sem fluxo continua
 * avulsa. Devolve `undefined` quando não há fluxo para ela.
 */
export async function enterClientFlow(
  scope: AgencyScope,
  task: Task,
  opts: { by: string; keepAssignee: boolean },
): Promise<Task | undefined> {
  if (task.flowId || !task.client) return undefined;
  const ctx = await contextFor(scope, task.client);
  if (!ctx.flowId) return undefined;
  const flow = await getFlow(scope, ctx.flowId);
  if (!flow || flow.status !== "ativo") return undefined;
  const step = startStep(flow);
  if (!step) return undefined;
  const { member, name } = receiver(step, ctx);
  const assignee = opts.keepAssignee && task.assignee !== "—" ? task.assignee : (name ?? undefined);
  return moveTaskToStep(scope, task.id, {
    flowId: flow.id,
    stepId: step.id,
    status: task.status,
    assignee,
    dueDate: task.dueDate ?? dueFor(step),
    note: {
      author: SYSTEM,
      text: `Entrou no fluxo ${flow.name} (o fluxo de ${task.client}), etapa ${step.name} — com ${
        opts.keepAssignee && task.assignee !== "—" ? task.assignee : who(member, name)
      }.`,
    },
  });
}

/** O dia do criativo no Planejamento — é ele que vira o prazo da tarefa. */
function plannedDate(piece: Piece): string | null {
  const d = new Date(piece.date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pieceTaskTitle(batch: Batch, piece: Piece): string {
  return `${piece.name} · ${batch.label}`;
}

/** A descrição da tarefa do criativo: o que é, para quando, e o briefing. */
function pieceTaskDescription(batch: Batch, piece: Piece): string {
  const date = new Date(piece.date);
  const when = Number.isNaN(date.getTime())
    ? ""
    : ` — para ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}`;
  const lines = [`Criativo do lote **${batch.label}** (${piece.kind}, ${piece.size})${when}.`];
  if (piece.briefing?.trim()) lines.push("", "## Briefing para o designer", piece.briefing.trim());
  if (piece.caption?.trim()) lines.push("", "## Legenda", piece.caption.trim());
  return lines.join("\n");
}

/**
 * A peça mudou no planejamento ou no editor: a tarefa dela acompanha o nome e
 * a descrição (formato, data, briefing). A conversa e a etapa não mudam.
 */
export async function syncPieceTask(scope: AgencyScope, batch: Batch, piece: Piece): Promise<void> {
  const task = await findTaskBySource(scope, piece.id);
  if (!task) return;
  const title = pieceTaskTitle(batch, piece);
  const description = pieceTaskDescription(batch, piece);
  const dueDate = plannedDate(piece);
  if (task.title === title && task.description === description && task.dueDate === dueDate) return;
  await updateTask(scope, task.id, { title, description, dueDate });
}

/** Deixa um registro na conversa sem mexer na etapa. */
async function noteOnly(scope: AgencyScope, task: Task, text: string): Promise<Task | undefined> {
  if (!task.flowId || !task.stepId) {
    return addTaskComment(scope, task.id, { author: SYSTEM, text });
  }
  return moveTaskToStep(scope, task.id, {
    flowId: task.flowId,
    stepId: task.stepId,
    status: task.status,
    dueDate: task.dueDate,
    note: { author: SYSTEM, text },
  });
}

async function enter(
  scope: AgencyScope,
  task: Task,
  flow: Flow,
  step: FlowStep,
  text: (quem: string) => string,
): Promise<Task | undefined> {
  const ctx = await contextFor(scope, task.client);
  const { member, name } = receiver(step, ctx);
  const note = text(who(member, name));
  const moved = await moveTaskToStep(scope, task.id, {
    flowId: flow.id,
    stepId: step.id,
    status: "a-fazer",
    assignee: name ?? undefined,
    // Tarefa de criativo mantém o dia planejado; as outras ganham o prazo da etapa.
    dueDate: task.source ? task.dueDate : dueFor(step),
    note: { author: SYSTEM, text: note },
  });
  // Quem recebe a etapa é avisado — mesmo que já fosse o responsável, porque
  // a tarefa voltou para a mão dele com trabalho novo.
  if (moved) await notifyTaskChange(scope, { name: SYSTEM }, { ...task, assignee: "" }, moved, note);
  return moved;
}

/**
 * A tarefa foi concluída: se ela está num fluxo, vai para a próxima etapa, com
 * quem toca essa etapa, prazo novo e o registro na conversa. Na última etapa
 * ela fica concluída — é o fim do fluxo.
 *
 * Devolve a tarefa como ficou (ou `undefined` quando não era de fluxo).
 */
export async function advanceTask(
  scope: AgencyScope,
  taskId: string,
  by: string,
): Promise<Task | undefined> {
  const task = await getTask(scope, taskId);
  if (!task?.flowId || !task.stepId || task.status !== "concluido") return undefined;
  const flow = await getFlow(scope, task.flowId);
  const current = flow?.steps.find((s) => s.id === task.stepId);
  if (!flow || !current) return undefined;

  const next = nextStep(flow, current.id);
  if (!next) {
    return noteOnly(scope, task, `${current.name} concluída por ${by} — fim do fluxo ${flow.name}.`);
  }
  return enter(
    scope,
    task,
    flow,
    next,
    (quem) => `${current.name} concluída por ${by} → encaminhada para ${next.name}, com ${quem}.`,
  );
}

/** A etapa anterior ligada — para onde volta o ajuste pedido pelo cliente. */
function previousStep(flow: Flow, stepId: string): FlowStep | null {
  const i = flow.steps.findIndex((s) => s.id === stepId);
  for (let j = i - 1; j >= 0; j--) if (!flow.steps[j].disabled) return flow.steps[j];
  return null;
}

/**
 * A decisão do cliente chega na tarefa do criativo.
 *
 * - **Aprovado** numa etapa do cliente: a etapa está feita, e a tarefa segue
 *   para a próxima (a publicação, no fluxo padrão).
 * - **Ajuste**: a tarefa volta uma etapa, com o motivo na conversa — quem
 *   produziu é quem precisa ler o que o cliente pediu.
 *
 * O `scope` aqui vem do lote que o token resolveu (ver `scopeOfBatch`).
 */
export async function onClientDecision(
  scope: AgencyScope,
  pieceId: string,
  decision: "aprovado" | "ajuste" | "pendente",
  reason?: string,
): Promise<void> {
  const task = await findTaskBySource(scope, pieceId);
  if (!task?.flowId || !task.stepId) return;
  const flow = await getFlow(scope, task.flowId);
  const current = flow?.steps.find((s) => s.id === task.stepId);
  if (!flow || !current) return;

  if (decision === "aprovado" && current.assignee.kind === "cliente") {
    const next = nextStep(flow, current.id);
    if (!next) {
      await moveTaskToStep(scope, task.id, {
        flowId: flow.id,
        stepId: current.id,
        status: "concluido",
        dueDate: null,
        note: { author: SYSTEM, text: `Aprovada pelo cliente — fim do fluxo ${flow.name}.` },
      });
      return;
    }
    await enter(scope, task, flow, next, (quem) => `Aprovada pelo cliente → encaminhada para ${next.name}, com ${quem}.`);
    return;
  }

  if (decision === "ajuste") {
    const back = current.assignee.kind === "cliente" ? previousStep(flow, current.id) : current;
    if (!back) return;
    const motivo = reason?.trim() ? `: "${reason.trim()}"` : "";
    await enter(scope, task, flow, back, (quem) => `O cliente pediu ajuste${motivo} → de volta para ${back.name}, com ${quem}.`);
  }
}

/**
 * O escopo de um lote achado pelo link público. O link não tem sessão; quem
 * autoriza é o token, e ele resolve exatamente um lote — é desse lote, e só
 * dele, que sai a agência onde a tarefa é procurada.
 */
export function scopeOfBatch(batch: Batch): AgencyScope {
  return { agencyId: batch.agencyId, agencyName: "" };
}

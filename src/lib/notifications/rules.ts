import { mentionsIn } from "@/lib/inbox/handle";
import { normalize } from "@/lib/inbox/view";
import type { NotificationInput } from "./types";
import { excerpt } from "./view";

/*
 * Quem recebe o quê. Funções puras (testadas em
 * `tests/notifications-rules.test.ts`): recebem o time e o que mudou, e
 * devolvem os avisos — quem grava e entrega é `dispatch.ts`.
 *
 * Três regras valem para todas:
 *
 * - **Ninguém é avisado do que ele mesmo fez.** Atribuir a si, se marcar,
 *   comentar na própria tarefa: nada.
 * - **Só quem está trabalhando recebe.** Convidado, inativo e arquivado ficam
 *   de fora, como ficam fora do menu de @.
 * - **Um aviso por pessoa por evento.** Quem recebeu a tarefa e foi marcado
 *   no mesmo briefing recebe a atribuição — a menção ali é redundante.
 */

export type Person = { id: string; name: string; handle: string; status: string };

/** Quem fez — pelo id de membro quando se sabe, senão pelo nome. */
export type Actor = { id?: string | null; name: string };

/** O fluxo (automação), não uma pessoa. */
export const SYSTEM_ACTOR = "black berry";

type TaskLike = {
  id: string;
  title: string;
  client: string;
  assignee: string;
  description: string;
};

const working = (team: Person[]) => team.filter((p) => p.status === "ativo");

function isActor(p: Person, actor: Actor): boolean {
  if (actor.id) return p.id === actor.id;
  return normalize(p.name) === normalize(actor.name);
}

/** O membro cujo nome é o responsável gravado na tarefa (o `assignee` é nome). */
export function memberByName(team: Person[], name: string): Person | undefined {
  const wanted = normalize(name);
  if (!wanted || wanted === "—") return undefined;
  return working(team).find((p) => normalize(p.name) === wanted);
}

function byHandles(team: Person[], handles: string[]): Person[] {
  const set = new Set(handles.map((h) => h.toLowerCase()));
  return working(team).filter((p) => set.has(p.handle));
}

function taskHref(task: TaskLike) {
  return { href: `/tarefas/${encodeURIComponent(task.id)}`, ref: `tarefa:${task.id}` };
}

/**
 * A tarefa foi criada ou mudou: quem passou a ser o responsável e quem foi
 * marcado **agora** no briefing (menção que já estava lá não avisa de novo).
 */
export function taskNotifications(
  team: Person[],
  actor: Actor,
  before: TaskLike | undefined,
  after: TaskLike,
  /** O motivo, quando foi o fluxo: "Design concluída → Revisão". */
  why = "",
): NotificationInput[] {
  const out: NotificationInput[] = [];
  const link = taskHref(after);
  const told = new Set<string>();

  const changed = normalize(after.assignee) !== normalize(before?.assignee ?? "");
  const owner = changed ? memberByName(team, after.assignee) : undefined;
  if (owner && !isActor(owner, actor)) {
    told.add(owner.id);
    out.push({
      recipientId: owner.id,
      kind: "atribuicao",
      actor: actor.name,
      title:
        actor.name === SYSTEM_ACTOR
          ? `"${after.title}" chegou para você`
          : `${actor.name} atribuiu "${after.title}" a você`,
      body: excerpt(why || (after.client ? `Cliente: ${after.client}` : "")),
      ...link,
    });
  }

  const had = new Set(mentionsIn(before?.description ?? ""));
  const fresh = mentionsIn(after.description).filter((h) => !had.has(h));
  for (const p of byHandles(team, fresh)) {
    if (told.has(p.id) || isActor(p, actor)) continue;
    told.add(p.id);
    out.push({
      recipientId: p.id,
      kind: "mencao",
      actor: actor.name,
      title: `${actor.name} te marcou em "${after.title}"`,
      body: excerpt(lineWith(after.description, p.handle)),
      ...link,
    });
  }
  return out;
}

/**
 * Um comentário na conversa da tarefa: quem foi marcado nele, e o
 * responsável da tarefa (se não foi ele quem comentou nem foi marcado).
 */
export function commentNotifications(
  team: Person[],
  actor: Actor,
  task: TaskLike,
  text: string,
): NotificationInput[] {
  const out: NotificationInput[] = [];
  const link = taskHref(task);
  const told = new Set<string>();
  for (const p of byHandles(team, mentionsIn(text))) {
    if (isActor(p, actor)) continue;
    told.add(p.id);
    out.push({
      recipientId: p.id,
      kind: "mencao",
      actor: actor.name,
      title: `${actor.name} te marcou num comentário em "${task.title}"`,
      body: excerpt(text),
      ...link,
    });
  }
  const owner = memberByName(team, task.assignee);
  if (owner && !told.has(owner.id) && !isActor(owner, actor)) {
    out.push({
      recipientId: owner.id,
      kind: "comentario",
      actor: actor.name,
      title: `${actor.name} comentou em "${task.title}"`,
      body: excerpt(text),
      ...link,
    });
  }
  return out;
}

/**
 * Mensagem nova numa conversa. Quem foi marcado recebe a menção — mesmo com
 * a conversa silenciada, que é para isso que o @ existe. O resto recebe
 * "mensagem", que se junta às outras da mesma conversa até ser lida; quem
 * silenciou não recebe.
 */
export function messageNotifications(
  team: Person[],
  actor: Actor,
  conversation: {
    id: string;
    kind: "grupo" | "direta";
    /** Nome do grupo; vazio na direta. */
    group: string;
    memberIds: string[];
    mutedBy: string[];
  },
  /** O texto, ou a descrição do anexo quando não há texto ("Áudio", "GIF"). */
  text: string,
): NotificationInput[] {
  const link = {
    href: `/inbox?conversa=${encodeURIComponent(conversation.id)}`,
    ref: `conversa:${conversation.id}`,
  };
  const inside = new Set(conversation.memberIds);
  const muted = new Set(conversation.mutedBy);
  const mentioned = new Set(byHandles(team, mentionsIn(text)).map((p) => p.id));
  const where = conversation.kind === "grupo" && conversation.group ? ` em ${conversation.group}` : "";
  const out: NotificationInput[] = [];
  for (const p of working(team)) {
    if (!inside.has(p.id) || isActor(p, actor)) continue;
    if (mentioned.has(p.id)) {
      out.push({
        recipientId: p.id,
        kind: "mencao",
        actor: actor.name,
        title: `${actor.name} te marcou${where}`,
        body: excerpt(text),
        ...link,
      });
    } else if (!muted.has(p.id)) {
      out.push({
        recipientId: p.id,
        kind: "mensagem",
        actor: actor.name,
        title: `${actor.name}${where}`,
        body: excerpt(text),
        ...link,
      });
    }
  }
  return out;
}

/** A linha do briefing onde a pessoa foi marcada — o contexto da menção. */
function lineWith(text: string, handle: string): string {
  const line = text.split("\n").find((l) => mentionsIn(l).includes(handle));
  return line ?? text;
}

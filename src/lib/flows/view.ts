import type { Flow, FlowStatus, FlowStep, StepAssignee } from "./types";

/*
 * A régua dos fluxos: por onde a tarefa entra, para onde ela vai ao concluir
 * uma etapa, e quem a recebe. Tudo função pura — testada em
 * `tests/flows-view.test.ts` —, porque é daqui que sai o "de quem é esta
 * tarefa agora", e um erro aqui entrega trabalho à pessoa errada sem erro
 * nenhum aparecer na tela.
 */

export const FLOW_STATUS_LABEL: Record<FlowStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  rascunho: "Rascunho",
  arquivado: "Arquivado",
};

export function isFlowStatus(v: unknown): v is FlowStatus {
  return v === "ativo" || v === "inativo" || v === "rascunho" || v === "arquivado";
}

/** "6 etapas · Ativo" — a linha de baixo do item da lista. */
export function flowMeta(flow: Flow): string {
  const n = flow.steps.length;
  return `${n} ${n === 1 ? "etapa" : "etapas"} · ${FLOW_STATUS_LABEL[flow.status]}`;
}

/**
 * O fluxo que o criativo de um cliente segue, entre os fluxos da agência: o
 * escolhido na ficha dele, se estiver ativo; senão o primeiro ativo marcado
 * "Todos os clientes". Fluxo "Clientes específicos" nunca pega cliente de
 * fora. Fluxo sem etapa ligada não tem por onde a tarefa entrar — fica de
 * fora também, e o cliente cai no padrão (ou em nenhum).
 */
export function pickFlowForClient(flows: Flow[], clientFlowId: string | null | undefined): Flow | undefined {
  const usable = flows.filter((f) => f.status === "ativo" && startStep(f));
  return usable.find((f) => f.id === clientFlowId) ?? usable.find((f) => f.appliesTo === "todos");
}

/** Onde a tarefa entra: a etapa marcada como início, ou a primeira ligada. */
export function startStep(flow: Flow): FlowStep | null {
  const marked = flow.steps.find((s) => s.id === flow.startStepId && !s.disabled);
  return marked ?? flow.steps.find((s) => !s.disabled) ?? null;
}

/**
 * Para onde a tarefa vai ao concluir `stepId`: a próxima escolhida na etapa
 * ou, sem escolha, a seguinte na ordem. Etapa desativada é pulada — a tarefa
 * segue para a que viria depois dela. `null` é fim de fluxo.
 */
export function nextStep(flow: Flow, stepId: string): FlowStep | null {
  const seen = new Set<string>([stepId]);
  let current = flow.steps.find((s) => s.id === stepId);
  while (current) {
    const explicit = current.nextStepId
      ? flow.steps.find((s) => s.id === current!.nextStepId)
      : undefined;
    const i = flow.steps.indexOf(current);
    const candidate = explicit ?? flow.steps[i + 1];
    // Um "próxima" que aponta para trás num laço não pode prender a tarefa.
    if (!candidate || seen.has(candidate.id)) return null;
    if (!candidate.disabled) return candidate;
    seen.add(candidate.id);
    current = candidate;
  }
  return null;
}

/** "Etapa 3 de 6" — posição na ordem do pipeline, contando de 1. */
export function stepPosition(flow: Flow, stepId: string): { index: number; total: number } | null {
  const i = flow.steps.findIndex((s) => s.id === stepId);
  return i === -1 ? null : { index: i + 1, total: flow.steps.length };
}

/** "02" — o número da etapa no card. */
export function stepNumber(flow: Flow, stepId: string): string {
  const pos = stepPosition(flow, stepId);
  return pos ? String(pos.index).padStart(2, "0") : "—";
}

/**
 * Quem recebe a tarefa numa etapa, em id de membro. `null` quando ninguém dá
 * para resolver (cliente sem squad, por exemplo) — quem chama decide o que
 * fazer com a tarefa sem dono.
 *
 * Etapa do cliente fica com o squad: a decisão é do cliente, mas é o time
 * dele que acompanha e cobra.
 */
export function assigneeFor(
  assignee: StepAssignee,
  squad: string[],
  team: { id: string }[],
): string | null {
  const exists = (id: string) => team.some((m) => m.id === id);
  if (assignee.kind === "membro") return exists(assignee.memberId) ? assignee.memberId : null;
  return squad.find(exists) ?? null;
}

/** Soma dias úteis (seg–sex) a uma data. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.floor(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/* ------------------------------------------------ edição do pipeline */

/** Troca de lugar com a vizinha ("Mover para esquerda/direita"). */
export function moveStep(steps: FlowStep[], stepId: string, dir: -1 | 1): FlowStep[] {
  const i = steps.findIndex((s) => s.id === stepId);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= steps.length) return steps;
  const out = [...steps];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * Tira a etapa e conserta quem apontava para ela: a "próxima" de quem vinha
 * antes passa a ser a próxima da removida, para a esteira não ficar furada.
 */
export function removeStep(flow: Flow, stepId: string): Pick<Flow, "steps" | "startStepId"> {
  const gone = flow.steps.find((s) => s.id === stepId);
  if (!gone) return { steps: flow.steps, startStepId: flow.startStepId };
  const steps = flow.steps
    .filter((s) => s.id !== stepId)
    .map((s) => (s.nextStepId === stepId ? { ...s, nextStepId: gone.nextStepId } : s));
  return {
    steps,
    startStepId: flow.startStepId === stepId ? null : flow.startStepId,
  };
}

/** Cópia logo depois da original, com "(cópia)" no nome e id novo. */
export function duplicateStep(steps: FlowStep[], stepId: string, newId: string): FlowStep[] {
  const i = steps.findIndex((s) => s.id === stepId);
  if (i === -1) return steps;
  const copy: FlowStep = {
    ...structuredClone(steps[i]),
    id: newId,
    name: `${steps[i].name} (cópia)`,
    nextStepId: null,
  };
  return [...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)];
}

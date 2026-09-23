import { read, transaction, normalizeStep } from "./store";
import { blankStep } from "./constants";
import { socialMediaTemplate } from "./seed";
import { isFlowStatus } from "./view";
import type { AgencyScope } from "@/lib/agency/types";
import type { Flow, FlowStatus, FlowStep } from "./types";

/*
 * Tudo que o app faz com fluxo passa por aqui. Mesmas regras das outras
 * áreas: `AgencyScope` como primeiro argumento, vindo só da sessão, e fluxo de
 * outra agência responde como inexistente.
 */

export class ValidationError extends Error {}

function makeId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export async function listFlows(scope: AgencyScope): Promise<Flow[]> {
  return (await read())
    .filter((f) => f.agencyId === scope.agencyId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getFlow(scope: AgencyScope, id: string): Promise<Flow | undefined> {
  return (await read()).find((f) => f.id === id && f.agencyId === scope.agencyId);
}

/**
 * O fluxo que a tarefa de um criativo segue: o escolhido na ficha do cliente,
 * se ainda estiver ativo; senão o primeiro fluxo ativo da agência. Sem
 * nenhum, `undefined` — a tarefa nasce fora de fluxo, como sempre nasceu.
 */
export async function flowForClient(
  scope: AgencyScope,
  clientFlowId: string | null | undefined,
): Promise<Flow | undefined> {
  const flows = (await listFlows(scope)).filter((f) => f.status === "ativo");
  return flows.find((f) => f.id === clientFlowId) ?? flows[0];
}

export async function createFlow(
  scope: AgencyScope,
  input: { name: string; by: string; template?: "social-media" },
): Promise<Flow> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new ValidationError("O fluxo precisa de um nome.");
  const now = new Date().toISOString();
  // O modelo nasce ligado: é a esteira pronta, para o primeiro criativo já cair nela.
  const fromTemplate = input.template === "social-media";
  const flow: Flow = {
    id: makeId("f"),
    agencyId: scope.agencyId,
    name,
    status: fromTemplate ? "ativo" : "inativo",
    steps: fromTemplate ? socialMediaTemplate() : [blankStep(makeId("s"))],
    startStepId: null,
    updatedAt: now,
    updatedBy: input.by,
    createdAt: now,
  };
  return transaction((flows) => {
    flows.push(flow);
    return structuredClone(flow);
  });
}

export type FlowPatch = {
  name?: string;
  status?: FlowStatus;
  steps?: (Partial<FlowStep> & { id?: string })[];
  startStepId?: string | null;
};

/**
 * Grava o fluxo inteiro de uma vez — o pipeline é editado como um todo
 * (mover, duplicar, remover mexem em mais de uma etapa). Cada etapa passa
 * pela mesma normalização da leitura; etapa sem id ganha um.
 */
export async function updateFlow(
  scope: AgencyScope,
  id: string,
  patch: FlowPatch,
  by: string,
): Promise<Flow | undefined> {
  if (patch.status !== undefined && !isFlowStatus(patch.status)) {
    throw new ValidationError("Status inválido.");
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new ValidationError("O fluxo precisa de um nome.");
  }
  let steps: FlowStep[] | undefined;
  if (patch.steps !== undefined) {
    if (!Array.isArray(patch.steps) || patch.steps.length === 0) {
      throw new ValidationError("O fluxo precisa de pelo menos uma etapa.");
    }
    if (patch.steps.length > 20) throw new ValidationError("Um fluxo vai até 20 etapas.");
    steps = patch.steps.map((s) => normalizeStep({ ...s, id: s.id ? String(s.id) : makeId("s") }));
    const ids = new Set(steps.map((s) => s.id));
    if (ids.size !== steps.length) throw new ValidationError("Etapas repetidas.");
    steps = steps.map((s) => (s.nextStepId && !ids.has(s.nextStepId) ? { ...s, nextStepId: null } : s));
  }

  return transaction((flows) => {
    const f = flows.find((x) => x.id === id && x.agencyId === scope.agencyId);
    if (!f) return undefined;
    if (patch.name !== undefined) f.name = patch.name.trim().slice(0, 60);
    if (patch.status !== undefined) f.status = patch.status;
    if (steps) f.steps = steps;
    if (patch.startStepId !== undefined) f.startStepId = patch.startStepId;
    if (f.startStepId && !f.steps.some((s) => s.id === f.startStepId)) f.startStepId = null;
    f.updatedAt = new Date().toISOString();
    f.updatedBy = by;
    return structuredClone(f);
  });
}

export async function duplicateFlow(
  scope: AgencyScope,
  id: string,
  by: string,
): Promise<Flow | undefined> {
  return transaction((flows) => {
    const f = flows.find((x) => x.id === id && x.agencyId === scope.agencyId);
    if (!f) return undefined;
    const now = new Date().toISOString();
    const copy: Flow = {
      ...structuredClone(f),
      id: makeId("f"),
      name: `${f.name} (cópia)`.slice(0, 60),
      // A cópia nasce desligada: dois fluxos iguais ativos disputariam tarefa.
      status: "inativo",
      updatedAt: now,
      updatedBy: by,
      createdAt: now,
    };
    flows.push(copy);
    return structuredClone(copy);
  });
}

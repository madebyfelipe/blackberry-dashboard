import { read, transaction, normalizeStep } from "./store";
import {
  FLOW_DESCRIPTION_MAX,
  FLOW_NAME_MAX,
  isFlowAppliesTo,
  isFlowCategory,
  isFlowColor,
  isFlowIcon,
} from "./constants";
import { flowTemplate } from "./templates";
import { isFlowStatus, pickFlowForClient } from "./view";
import type { AgencyScope } from "@/lib/agency/types";
import type {
  Flow,
  FlowAppliesTo,
  FlowCategory,
  FlowColor,
  FlowIcon,
  FlowStatus,
  FlowStep,
  FlowTemplateId,
} from "./types";

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
 * se ainda estiver ativo; senão o fluxo ativo marcado "Todos os clientes"
 * (ver `pickFlowForClient`). Sem nenhum, `undefined` — a tarefa nasce fora de
 * fluxo, como sempre nasceu.
 */
export async function flowForClient(
  scope: AgencyScope,
  clientFlowId: string | null | undefined,
): Promise<Flow | undefined> {
  return pickFlowForClient(await listFlows(scope), clientFlowId);
}

/** O que o Novo fluxo manda: o modelo escolhido e o passo "Detalhes". */
export type NewFlow = {
  name: string;
  by: string;
  template?: FlowTemplateId;
  description?: string;
  category?: FlowCategory;
  icon?: FlowIcon;
  color?: FlowColor;
  appliesTo?: FlowAppliesTo;
  /** "Criar fluxo" (ativo ou inativo, pelo "Ativar ao criar") ou "Salvar rascunho". */
  status?: Exclude<FlowStatus, "arquivado">;
};

export async function createFlow(scope: AgencyScope, input: NewFlow): Promise<Flow> {
  const name = input.name.trim().slice(0, FLOW_NAME_MAX);
  if (!name) throw new ValidationError("O fluxo precisa de um nome.");
  // Vem da requisição: o tipo não garante nada — fluxo não nasce arquivado.
  if (input.status !== undefined && (!isFlowStatus(input.status) || (input.status as string) === "arquivado")) {
    throw new ValidationError("Status inválido.");
  }
  const template = flowTemplate(input.template ?? "zero");
  const now = new Date().toISOString();
  const flow: Flow = {
    id: makeId("f"),
    agencyId: scope.agencyId,
    name,
    description: (input.description ?? "").trim().slice(0, FLOW_DESCRIPTION_MAX),
    category: isFlowCategory(input.category) ? input.category : template.category,
    icon: isFlowIcon(input.icon) ? input.icon : template.icon,
    color: isFlowColor(input.color) ? input.color : template.color,
    appliesTo: isFlowAppliesTo(input.appliesTo) ? input.appliesTo : "especificos",
    // Sem status explícito vale o do modelo: a esteira pronta nasce ligada.
    status: input.status ?? (template.activate ? "ativo" : "inativo"),
    steps: template.steps(),
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
  description?: string;
  category?: FlowCategory;
  icon?: FlowIcon;
  color?: FlowColor;
  appliesTo?: FlowAppliesTo;
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
  if (patch.category !== undefined && !isFlowCategory(patch.category)) {
    throw new ValidationError("Categoria inválida.");
  }
  if (patch.icon !== undefined && !isFlowIcon(patch.icon)) throw new ValidationError("Ícone inválido.");
  if (patch.color !== undefined && !isFlowColor(patch.color)) throw new ValidationError("Cor inválida.");
  if (patch.appliesTo !== undefined && !isFlowAppliesTo(patch.appliesTo)) {
    throw new ValidationError("Escolha entre todos os clientes e clientes específicos.");
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
    if (patch.name !== undefined) f.name = patch.name.trim().slice(0, FLOW_NAME_MAX);
    if (patch.description !== undefined) {
      f.description = String(patch.description).trim().slice(0, FLOW_DESCRIPTION_MAX);
    }
    if (patch.category !== undefined) f.category = patch.category;
    if (patch.icon !== undefined) f.icon = patch.icon;
    if (patch.color !== undefined) f.color = patch.color;
    if (patch.appliesTo !== undefined) f.appliesTo = patch.appliesTo;
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
      name: `${f.name} (cópia)`.slice(0, FLOW_NAME_MAX),
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

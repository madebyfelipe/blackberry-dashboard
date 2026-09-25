import { FLOW_COLORS, FLOW_NAME_MAX } from "./constants";
import { flowTemplate } from "./templates";
import type {
  Flow,
  FlowAppliesTo,
  FlowCategory,
  FlowColor,
  FlowIcon,
  FlowTemplateId,
} from "./types";

/*
 * A régua do Novo fluxo (exports "Novo Fluxo · 1. Modelo / 2. Detalhes /
 * 3. Revisão"): o rascunho que os três passos preenchem, o que muda quando a
 * pessoa volta e troca de modelo, e o que impede de seguir. Função pura —
 * testada em `tests/flows-wizard.test.ts`.
 */

export type FlowDraft = {
  template: FlowTemplateId;
  name: string;
  description: string;
  category: FlowCategory;
  icon: FlowIcon;
  color: FlowColor;
  appliesTo: FlowAppliesTo;
  /** Só vale em "Clientes específicos". */
  clientIds: string[];
  /** "Ativar ao criar". */
  activate: boolean;
};

/** O rascunho de quem acabou de escolher um modelo. */
export function draftFor(template: FlowTemplateId): FlowDraft {
  const t = flowTemplate(template);
  return {
    template: t.id,
    name: t.name,
    description: "",
    category: t.category,
    icon: t.icon,
    color: t.color,
    appliesTo: "especificos",
    clientIds: [],
    activate: t.activate,
  };
}

/** O rascunho da edição: o fluxo como está, com os clientes dele marcados. */
export function draftFromFlow(flow: Flow, clientIds: string[]): FlowDraft {
  return {
    template: "zero",
    name: flow.name,
    description: flow.description,
    category: flow.category,
    icon: flow.icon,
    color: flow.color,
    appliesTo: flow.appliesTo,
    clientIds,
    activate: flow.status === "ativo",
  };
}

/**
 * Voltou ao passo "Modelo" e escolheu outro: o que ainda é o padrão do modelo
 * antigo passa a ser o do novo; o que a pessoa já mexeu fica como está.
 * Descrição e clientes não dependem do modelo — nunca mudam aqui.
 */
export function switchTemplate(draft: FlowDraft, to: FlowTemplateId): FlowDraft {
  if (draft.template === to) return draft;
  const from = flowTemplate(draft.template);
  const next = flowTemplate(to);
  const keep = <K extends "name" | "icon" | "color" | "category" | "activate">(k: K, a: FlowDraft[K], b: FlowDraft[K]) =>
    draft[k] === a ? b : draft[k];
  return {
    ...draft,
    template: next.id,
    name: keep("name", from.name, next.name),
    icon: keep("icon", from.icon, next.icon),
    color: keep("color", from.color, next.color),
    category: keep("category", from.category, next.category),
    activate: keep("activate", from.activate, next.activate),
  };
}

/** O que falta para sair do passo "Detalhes" — `null` quando pode seguir. */
export function draftError(
  draft: FlowDraft,
): { field: "name" | "clients"; message: string } | null {
  if (!draft.name.trim()) return { field: "name", message: "Dê um nome ao fluxo." };
  if (draft.name.trim().length > FLOW_NAME_MAX) {
    return { field: "name", message: `O nome vai até ${FLOW_NAME_MAX} caracteres.` };
  }
  if (draft.appliesTo === "especificos" && draft.clientIds.length === 0) {
    return { field: "clients", message: "Escolha pelo menos um cliente — ou todos os clientes." };
  }
  return null;
}

/** "3 clientes selecionados" — o pé do passo "Detalhes". */
export function clientsHint(draft: FlowDraft): string {
  if (draft.appliesTo === "todos") return "Todos os clientes sem fluxo próprio";
  const n = draft.clientIds.length;
  if (n === 0) return "Nenhum cliente selecionado";
  return `${n} ${n === 1 ? "cliente selecionado" : "clientes selecionados"}`;
}

/** Liga ou desliga um cliente da lista, sem repetir. */
export function toggleClient(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * A cor do avatar do cliente no passo "Detalhes": sempre a mesma para o mesmo
 * cliente, tirada da paleta do fluxo. `var(--token)`, nunca hex.
 */
export function clientColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FLOW_COLORS[h % FLOW_COLORS.length].value;
}

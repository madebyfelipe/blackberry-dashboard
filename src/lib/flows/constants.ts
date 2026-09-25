import type {
  AutomationId,
  FlowAppliesTo,
  FlowCategory,
  FlowColor,
  FlowIcon,
  FlowStep,
  StepAssignee,
  StepIcon,
} from "./types";

/** As automações do cartão "AÇÕES AUTOMÁTICAS", na ordem do export. */
export const AUTOMATIONS: { id: AutomationId; label: string }[] = [
  { id: "notificar", label: "Notificar próximo responsável" },
  { id: "postar", label: "Postar no #conteudo" },
  { id: "historico", label: "Registrar no histórico" },
  { id: "agendar", label: "Agendar publicação" },
];

export const STEP_ICONS: StepIcon[] = [
  "file-text",
  "pen-line",
  "palette",
  "scan-eye",
  "check-check",
  "send",
  "clapperboard",
  "megaphone",
  "search",
  "target",
  "sliders",
];

export function isStepIcon(v: unknown): v is StepIcon {
  return STEP_ICONS.includes(v as StepIcon);
}

export const NO_AUTOMATIONS: Record<AutomationId, boolean> = {
  notificar: false,
  postar: false,
  historico: false,
  agendar: false,
};

/** Etapa nova: vai para o squad do cliente, sem prazo, avisando o próximo. */
export function blankStep(id: string, name = "Nova etapa"): FlowStep {
  return {
    id,
    name,
    icon: "file-text",
    assignee: { kind: "squad" } satisfies StepAssignee,
    backupId: null,
    slaDays: null,
    alertDaysBefore: null,
    entryStatus: `Aguardando ${name.toLowerCase()}`,
    exitStatus: "Concluída",
    approvers: [],
    automations: { ...NO_AUTOMATIONS, notificar: true, historico: true },
    nextStepId: null,
    disabled: false,
  };
}

/* ------------------------------------------------- identidade do fluxo */

/** O que o "Trocar" oferece, na ordem da grade. */
export const FLOW_ICONS: FlowIcon[] = [
  "megaphone",
  "pen-line",
  "target",
  "palette",
  "clapperboard",
  "send",
  "zap",
  "chart-line",
  "calendar",
  "users",
  "file-text",
  "git-branch",
];

export function isFlowIcon(v: unknown): v is FlowIcon {
  return FLOW_ICONS.includes(v as FlowIcon);
}

/**
 * As cores do "Ícone e cor", na ordem do export. `value` vai direto para
 * `style` — é sempre `var(--token)`, nunca hex (ver `tests/design-tokens`).
 */
export const FLOW_COLORS: { id: FlowColor; label: string; value: string }[] = [
  { id: "indigo", label: "Índigo", value: "var(--color-flow-indigo)" },
  { id: "rose", label: "Rosa", value: "var(--color-flow-rose)" },
  { id: "orange", label: "Laranja", value: "var(--color-flow-orange)" },
  { id: "yellow", label: "Amarelo", value: "var(--color-flow-yellow)" },
  { id: "green", label: "Verde", value: "var(--color-flow-green)" },
  { id: "sky", label: "Azul", value: "var(--color-flow-sky)" },
  { id: "violet", label: "Violeta", value: "var(--color-flow-violet)" },
];

export function isFlowColor(v: unknown): v is FlowColor {
  return FLOW_COLORS.some((c) => c.id === v);
}

export function flowColorValue(id: FlowColor): string {
  return (FLOW_COLORS.find((c) => c.id === id) ?? FLOW_COLORS[0]).value;
}

/** O campo "Categoria" — o ponto de cada uma usa a paleta do fluxo. */
export const FLOW_CATEGORIES: { id: FlowCategory; label: string; dot: string }[] = [
  { id: "marketing", label: "Marketing / Conteúdo", dot: "var(--color-flow-violet)" },
  { id: "midia-paga", label: "Mídia paga", dot: "var(--color-flow-orange)" },
  { id: "atendimento", label: "Atendimento", dot: "var(--color-flow-sky)" },
  { id: "operacao", label: "Operação interna", dot: "var(--color-flow-green)" },
  { id: "outro", label: "Outro", dot: "var(--color-muted)" },
];

export function isFlowCategory(v: unknown): v is FlowCategory {
  return FLOW_CATEGORIES.some((c) => c.id === v);
}

export function flowCategory(id: FlowCategory): { id: FlowCategory; label: string; dot: string } {
  return FLOW_CATEGORIES.find((c) => c.id === id) ?? FLOW_CATEGORIES[FLOW_CATEGORIES.length - 1];
}

export function isFlowAppliesTo(v: unknown): v is FlowAppliesTo {
  return v === "todos" || v === "especificos";
}

/** Até onde vão os textos do passo "Detalhes". */
export const FLOW_NAME_MAX = 60;
export const FLOW_DESCRIPTION_MAX = 240;

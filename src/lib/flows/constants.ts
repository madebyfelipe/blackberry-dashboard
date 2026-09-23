import type { AutomationId, FlowStep, StepAssignee, StepIcon } from "./types";

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

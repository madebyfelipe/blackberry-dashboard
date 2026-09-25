import { NO_AUTOMATIONS } from "./constants";
import { socialMediaTemplate } from "./seed";
import type {
  FlowCategory,
  FlowColor,
  FlowIcon,
  FlowStep,
  FlowTemplateId,
} from "./types";

/*
 * Os modelos do passo "Modelo" do Novo fluxo (export "Novo Fluxo · 1.
 * Modelo"). Cada um é uma esteira pronta e a identidade que o fluxo recebe se
 * a pessoa não mexer em nada no passo "Detalhes": nome, ícone, cor e
 * categoria.
 *
 * As etapas de todos os modelos vão para o **squad do cliente** — um modelo
 * não conhece o time da agência —, e a Aprovação é do próprio cliente (o link
 * público). É o mesmo acordo do modelo Social Media, que já existia.
 */

export type FlowTemplate = {
  id: FlowTemplateId;
  label: string;
  /** Nome sugerido no passo "Detalhes"; vazio no "Começar do zero". */
  name: string;
  icon: FlowIcon;
  color: FlowColor;
  category: FlowCategory;
  /** "Ativar ao criar" já vem ligado? Fluxo sem etapa não tem o que ligar. */
  activate: boolean;
  steps: () => FlowStep[];
};

function step(
  row: Partial<FlowStep> & Pick<FlowStep, "id" | "name" | "icon">,
): FlowStep {
  return {
    assignee: { kind: "squad" },
    backupId: null,
    slaDays: null,
    alertDaysBefore: null,
    entryStatus: "",
    exitStatus: "",
    approvers: [],
    automations: { ...NO_AUTOMATIONS, notificar: true, historico: true },
    nextStepId: null,
    disabled: false,
    ...row,
  };
}

function blogSteps(): FlowStep[] {
  return [
    step({ id: "pauta", name: "Pauta", icon: "file-text", slaDays: 2, entryStatus: "Aguardando pauta", exitStatus: "Pauta definida" }),
    step({ id: "redacao", name: "Redação", icon: "pen-line", slaDays: 3, alertDaysBefore: 1, entryStatus: "Aguardando redação", exitStatus: "Pronto para SEO" }),
    step({ id: "seo", name: "SEO", icon: "search", slaDays: 1, entryStatus: "Em otimização", exitStatus: "Pronto para revisão" }),
    step({ id: "revisao", name: "Revisão", icon: "scan-eye", slaDays: 1, entryStatus: "Em revisão", exitStatus: "Pronto para publicar" }),
    step({
      id: "publicacao",
      name: "Publicação",
      icon: "send",
      entryStatus: "Agendando",
      exitStatus: "Publicado",
      automations: { ...NO_AUTOMATIONS, notificar: true, historico: true, agendar: true },
    }),
  ];
}

function paidMediaSteps(): FlowStep[] {
  return [
    step({ id: "estrategia", name: "Estratégia", icon: "target", slaDays: 2, entryStatus: "Aguardando estratégia", exitStatus: "Estratégia definida" }),
    step({ id: "criativos", name: "Criativos", icon: "palette", slaDays: 3, alertDaysBefore: 1, entryStatus: "Em criação", exitStatus: "Pronto para setup" }),
    step({ id: "setup", name: "Setup", icon: "sliders", slaDays: 1, entryStatus: "Configurando campanha", exitStatus: "Pronto para aprovação" }),
    step({
      id: "aprovacao",
      name: "Aprovação",
      icon: "check-check",
      assignee: { kind: "cliente" },
      slaDays: 2,
      entryStatus: "Com o cliente",
      exitStatus: "Aprovado",
      approvers: [{ memberId: null, required: true }],
    }),
  ];
}

/** Na ordem dos cards do export. */
export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "zero",
    label: "Começar do zero",
    name: "",
    icon: "zap",
    color: "indigo",
    category: "outro",
    activate: false,
    steps: () => [],
  },
  {
    id: "social-media",
    label: "Social Media",
    name: "Social Media - Padrão",
    icon: "megaphone",
    color: "indigo",
    category: "marketing",
    activate: true,
    steps: socialMediaTemplate,
  },
  {
    id: "blog",
    label: "Blog & Conteúdo",
    name: "Blog & Conteúdo",
    icon: "pen-line",
    color: "rose",
    category: "marketing",
    activate: true,
    steps: blogSteps,
  },
  {
    id: "paid-media",
    label: "Paid Media",
    name: "Paid Media",
    icon: "target",
    color: "orange",
    category: "midia-paga",
    activate: true,
    steps: paidMediaSteps,
  },
];

export function isFlowTemplateId(v: unknown): v is FlowTemplateId {
  return FLOW_TEMPLATES.some((t) => t.id === v);
}

export function flowTemplate(id: FlowTemplateId): FlowTemplate {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? FLOW_TEMPLATES[0];
}

/** O texto do card: a esteira do modelo, ou o convite do "Começar do zero". */
export function templateBlurb(t: FlowTemplate): string {
  const steps = t.steps();
  if (steps.length === 0) return "Monte um fluxo customizado etapa por etapa.";
  return `${steps.map((s) => s.name).join(" → ")}.`;
}

/** "6 etapas" · "Sem etapas" — o selo do card. */
export function templateStepCount(t: FlowTemplate): string {
  const n = t.steps().length;
  if (n === 0) return "Sem etapas";
  return `${n} ${n === 1 ? "etapa" : "etapas"}`;
}

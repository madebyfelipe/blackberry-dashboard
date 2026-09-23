import type { AgencyId } from "@/lib/agency/types";

/*
 * Fluxos e Processos — a sequência de trabalho da agência (export "Fluxos e
 * Processos", em Configurações).
 *
 * Um fluxo é a esteira por onde uma tarefa passa: Briefing → Redação → Design
 * → Revisão → Aprovação → Publicação. Cada etapa diz **quem** toca, em
 * **quanto tempo**, e **para onde** a tarefa vai quando é concluída. É isso
 * que faz a tarefa andar sozinha: concluir uma etapa entrega a tarefa ao
 * responsável da próxima (ver `automation.ts`).
 */

export type FlowStatus = "ativo" | "inativo" | "arquivado";

/** Os ícones das etapas do export — lucide, pelo nome. */
export type StepIcon =
  | "file-text"
  | "pen-line"
  | "palette"
  | "scan-eye"
  | "check-check"
  | "send"
  | "clapperboard"
  | "megaphone";

/**
 * Quem toca a etapa.
 *
 * - `membro`: uma pessoa do time, fixa.
 * - `squad`: o squad do cliente da tarefa — a etapa vale para todos os
 *   clientes, e cada um manda a tarefa para o time que cuida dele.
 * - `cliente`: a etapa é do cliente (a aprovação pelo link público). A
 *   tarefa fica com o squad, esperando a decisão chegar.
 */
export type StepAssignee =
  | { kind: "membro"; memberId: string }
  | { kind: "squad" }
  | { kind: "cliente" };

/** As automações do cartão "AÇÕES AUTOMÁTICAS" do export. */
export type AutomationId = "notificar" | "postar" | "historico" | "agendar";

export type StepApprover = {
  /** Membro do time; `null` é o cliente (aprovação externa). */
  memberId: string | null;
  required: boolean;
};

export type FlowStep = {
  id: string;
  name: string;
  icon: StepIcon;
  assignee: StepAssignee;
  /** Quem cobre o responsável (o "Backup" do cartão). */
  backupId: string | null;
  /** Prazo em dias úteis; `null` = sem prazo (o "—" do export). */
  slaDays: number | null;
  /** Avisar quantos dias antes do prazo; `null` = sem aviso. */
  alertDaysBefore: number | null;
  /** O status da tarefa ao entrar na etapa ("Aguardando redação"). */
  entryStatus: string;
  /** O status ao concluir ("Pronto para design"). */
  exitStatus: string;
  approvers: StepApprover[];
  automations: Record<AutomationId, boolean>;
  /**
   * Para onde a tarefa vai ao concluir. `null` segue a ordem do pipeline; a
   * última etapa sem próxima encerra o fluxo.
   */
  nextStepId: string | null;
  /** Etapa desativada: a tarefa pula por cima dela. */
  disabled: boolean;
};

export type Flow = {
  id: string;
  agencyId: AgencyId;
  name: string;
  status: FlowStatus;
  /** Na ordem do pipeline. */
  steps: FlowStep[];
  /** Onde a tarefa entra ("Definir como início"); `null` = a primeira. */
  startStepId: string | null;
  /** ISO — a "Última edição há 2 dias por Camila M." do cabeçalho. */
  updatedAt: string;
  updatedBy: string;
  createdAt: string;
};

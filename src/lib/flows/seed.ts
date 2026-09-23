import { LEGACY_AGENCY_ID } from "@/lib/agency/id";
import { NO_AUTOMATIONS } from "./constants";
import type { Flow, FlowStep } from "./types";

/*
 * O fluxo que o export "Fluxos e Processos" desenha por inteiro: "Social Media
 * - Padrão", com as seis etapas, prazos, statuses de entrada e saída, os
 * aprovadores e as automações da etapa Redação.
 *
 * Os outros sete nomes da lista do export ficam de fora de propósito: o
 * desenho não mostra as etapas deles, e inventar esteira de trabalho é pior
 * do que uma lista curta. As pessoas do desenho (Camila M., Rafael S., Luiza
 * T.) não existem no time semeado do Inbox; cada etapa vai para quem do time
 * faz esse papel na demonstração, e a Publicação fica com o squad do cliente.
 */

function step(row: Partial<FlowStep> & Pick<FlowStep, "id" | "name" | "icon" | "assignee">): FlowStep {
  return {
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

export function seedFlows(): Flow[] {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "social-media-padrao",
      agencyId: LEGACY_AGENCY_ID,
      name: "Social Media - Padrão",
      status: "ativo",
      startStepId: null,
      updatedAt: twoDaysAgo,
      updatedBy: "Camila",
      createdAt: twoDaysAgo,
      steps: [
        step({
          id: "briefing",
          name: "Briefing",
          icon: "file-text",
          assignee: { kind: "membro", memberId: "camila" },
          slaDays: 1,
          entryStatus: "Aguardando briefing",
          exitStatus: "Pronto para redação",
        }),
        step({
          id: "redacao",
          name: "Redação",
          icon: "pen-line",
          assignee: { kind: "membro", memberId: "rodrigo" },
          backupId: "marina",
          slaDays: 3,
          alertDaysBefore: 1,
          entryStatus: "Aguardando redação",
          exitStatus: "Pronto para design",
          approvers: [
            { memberId: "camila", required: true },
            { memberId: null, required: false },
          ],
          automations: { notificar: true, postar: true, historico: true, agendar: false },
        }),
        step({
          id: "design",
          name: "Design",
          icon: "palette",
          assignee: { kind: "membro", memberId: "ana" },
          slaDays: 2,
          entryStatus: "Fila",
          exitStatus: "Aprovar",
          approvers: [{ memberId: "camila", required: true }],
          automations: { notificar: true, postar: true, historico: true, agendar: false },
        }),
        step({
          id: "revisao",
          name: "Revisão",
          icon: "scan-eye",
          assignee: { kind: "membro", memberId: "camila" },
          slaDays: 1,
          entryStatus: "Em revisão",
          exitStatus: "Pronto para aprovação",
        }),
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
        step({
          id: "publicacao",
          name: "Publicação",
          icon: "send",
          assignee: { kind: "squad" },
          entryStatus: "Agendando",
          exitStatus: "Publicado",
          automations: { notificar: true, postar: false, historico: true, agendar: true },
        }),
      ],
    },
  ];
}

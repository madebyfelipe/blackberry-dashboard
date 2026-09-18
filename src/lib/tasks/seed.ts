import type { Task } from "./types";

/** Seed data mirrors the List View export so the app looks alive on first run. */
export function seedTasks(): Task[] {
  return [
    { id: "t1", title: "Quinzenal 2 - Montê", client: "Montê bar", status: "a-fazer", assignee: "F", createdAt: "2026-09-17T09:00:00.000Z" },
    { id: "t2", title: "Roteiro campanha lançamento", client: "Montê bar", status: "em-progresso", assignee: "M", createdAt: "2026-09-16T09:00:00.000Z" },
    { id: "t3", title: "Aprovar artes do feed", client: "Social media", status: "em-revisao", assignee: "A", createdAt: "2026-09-15T09:00:00.000Z" },
    { id: "t4", title: "Planejamento editorial", client: "Workspace", status: "concluido", assignee: "F", createdAt: "2026-09-12T09:00:00.000Z" },
    { id: "t5", title: "Briefing cliente Montê", client: "Montê bar", status: "a-fazer", assignee: "M", createdAt: "2026-09-18T09:00:00.000Z" },
    { id: "t6", title: "Ajustes identidade visual", client: "Social media", status: "pausado", assignee: "A", createdAt: "2026-09-10T09:00:00.000Z" },
    { id: "t7", title: "Relatório quinzenal", client: "Montê bar", status: "em-progresso", assignee: "F", createdAt: "2026-09-14T09:00:00.000Z" },
    { id: "t8", title: "Cancelar contrato antigo", client: "Equipe", status: "cancelado", assignee: "M", createdAt: "2026-09-08T09:00:00.000Z" },
  ];
}

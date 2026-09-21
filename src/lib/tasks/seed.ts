import { LEGACY_AGENCY_ID } from "@/lib/agency/id";
import type { Task, TaskPriority, TaskStatus } from "./types";

type SeedRow = {
  id: string;
  title: string;
  client: string;
  status: TaskStatus;
  assignee: string;
  createdAt: string;
  priority: TaskPriority;
  labels: string[];
  creator: string;
  /** Dias a partir da criação; ausente = sem prazo. */
  dueInDays?: number;
  description?: string;
};

const ROWS: SeedRow[] = [
  { id: "t1", title: "Quinzenal 2 - Montê", client: "Montê bar", status: "a-fazer", assignee: "Felipe", createdAt: "2026-09-17T09:00:00.000Z", priority: "alta", labels: ["quinzenal", "feed"], creator: "Felipe", dueInDays: 3 },
  { id: "t2", title: "Roteiro campanha lançamento", client: "Montê bar", status: "em-progresso", assignee: "Marina", createdAt: "2026-09-16T09:00:00.000Z", priority: "urgente", labels: ["campanha", "reels"], creator: "Marina", dueInDays: 2, description: "Roteiro dos 3 Reels de lançamento + chamada para o stories." },
  { id: "t3", title: "Aprovar artes do feed", client: "Social media", status: "em-revisao", assignee: "Ana", createdAt: "2026-09-15T09:00:00.000Z", priority: "media", labels: ["aprovacao"], creator: "Felipe", dueInDays: 1 },
  { id: "t4", title: "Planejamento editorial", client: "Workspace", status: "concluido", assignee: "Felipe", createdAt: "2026-09-12T09:00:00.000Z", priority: "media", labels: ["planejamento"], creator: "Felipe" },
  { id: "t5", title: "Briefing cliente Montê", client: "Montê bar", status: "a-fazer", assignee: "Marina", createdAt: "2026-09-18T09:00:00.000Z", priority: "baixa", labels: ["briefing"], creator: "Marina", dueInDays: 5 },
  { id: "t6", title: "Ajustes identidade visual", client: "Social media", status: "pausado", assignee: "Ana", createdAt: "2026-09-10T09:00:00.000Z", priority: "baixa", labels: ["identidade"], creator: "Ana" },
  { id: "t7", title: "Relatório quinzenal", client: "Montê bar", status: "em-progresso", assignee: "Felipe", createdAt: "2026-09-14T09:00:00.000Z", priority: "alta", labels: ["relatorio"], creator: "Felipe", dueInDays: 4 },
  { id: "t8", title: "Cancelar contrato antigo", client: "Equipe", status: "cancelado", assignee: "Marina", createdAt: "2026-09-08T09:00:00.000Z", priority: "sem", labels: [], creator: "Marina" },
];

/** Seed data mirrors the List View export so the app looks alive on first run. */
export function seedTasks(): Task[] {
  return ROWS.map(({ dueInDays, description, ...row }) => ({
    ...row,
    // A demonstração é da agência semeada — é ela que abre o app na primeira vez.
    agencyId: LEGACY_AGENCY_ID,
    description: description ?? "",
    comments: [],
    dueDate:
      dueInDays === undefined
        ? null
        : new Date(
            new Date(row.createdAt).getTime() + dueInDays * 86_400_000,
          ).toISOString(),
  }));
}

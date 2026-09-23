import type { Task } from "../../src/lib/tasks/types";
import { AGENCIA_A } from "./agency";

/** Uma tarefa completa e previsível; cada teste troca só o que interessa. */
export function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: "t0",
    agencyId: AGENCIA_A.agencyId,
    title: "Tarefa",
    client: "Clínica Aurora",
    status: "a-fazer",
    assignee: "MD",
    createdAt: new Date("2026-09-10T12:00:00.000Z").toISOString(),
    description: "",
    priority: "sem",
    labels: [],
    creator: "Felipe",
    dueDate: null,
    comments: [],
    flowId: null,
    stepId: null,
    source: null,
    ...over,
  };
}

export const DIA = 24 * 60 * 60 * 1000;

/** ISO deslocado em dias a partir de agora — para prazos relativos. */
export function emDias(dias: number): string {
  return new Date(Date.now() + dias * DIA).toISOString();
}

/**
 * Último milissegundo de hoje (hora local) — é o que o filtro "Vencem hoje"
 * usa como teto. Serve para um prazo que cai hoje sem correr o risco de já
 * ter vencido enquanto o teste roda.
 */
export function fimDeHoje(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

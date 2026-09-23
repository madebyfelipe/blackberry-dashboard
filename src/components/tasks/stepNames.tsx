"use client";

import { createContext, useContext } from "react";
import type { Task } from "@/lib/tasks/types";

/*
 * O nome da etapa de fluxo de cada tarefa, para a linha de baixo do card e
 * da lista ("Clínica Aurora · Redação"). Vem do servidor já achatado
 * (`fluxo:etapa` → nome) e desce por contexto: a Lista e o Quadro leem sem
 * a prop viajar por cada componente.
 */
const Ctx = createContext<Record<string, string>>({});

export const TaskStepsProvider = Ctx.Provider;

/** "Clínica Aurora · Redação"; sem fluxo, só o cliente. */
export function useTaskSub(): (t: Task) => string {
  const names = useContext(Ctx);
  return (t) => {
    const client = t.client || "Sem cliente";
    const step = t.flowId && t.stepId ? names[`${t.flowId}:${t.stepId}`] : undefined;
    return step ? `${client} · ${step}` : client;
  };
}

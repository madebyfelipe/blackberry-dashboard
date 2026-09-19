export type TaskStatus =
  | "a-fazer"
  | "em-progresso"
  | "em-revisao"
  | "concluido"
  | "pausado"
  | "cancelado";

/** Escala de prioridade — a régua vive em `priority.ts`. */
export type TaskPriority = "sem" | "baixa" | "media" | "alta" | "urgente";

export type Task = {
  id: string;
  title: string;
  /** Cliente / contexto (linha secundária) */
  client: string;
  status: TaskStatus;
  /** Iniciais ou nome curto do responsável */
  assignee: string;
  /** ISO date */
  createdAt: string;
  /** Texto livre do modal de tarefa. */
  description: string;
  priority: TaskPriority;
  /** Etiquetas livres, sem "#" (ex.: ["reels", "urgente-cliente"]). */
  labels: string[];
  /** Quem criou a tarefa (e-mail ou nome curto) — alimenta o filtro "Criador". */
  creator: string;
  /** Prazo interno, ISO. `null` = sem prazo. */
  dueDate: string | null;
};

export type NewTask = {
  title: string;
  client: string;
  status?: TaskStatus;
  assignee?: string;
  description?: string;
  priority?: TaskPriority;
  labels?: string[];
  creator?: string;
  dueDate?: string | null;
};

export type TaskPatch = Partial<Omit<Task, "id" | "createdAt">>;

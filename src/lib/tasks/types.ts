export type TaskStatus =
  | "a-fazer"
  | "em-progresso"
  | "em-revisao"
  | "concluido"
  | "pausado"
  | "cancelado";

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
};

export type NewTask = {
  title: string;
  client: string;
  status?: TaskStatus;
  assignee?: string;
};

export type TaskPatch = Partial<Omit<Task, "id" | "createdAt">>;

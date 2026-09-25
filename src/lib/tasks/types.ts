export type TaskStatus =
  | "a-fazer"
  | "em-progresso"
  | "em-revisao"
  | "concluido"
  | "pausado"
  | "cancelado";

/** Escala de prioridade — a régua vive em `priority.ts`. */
export type TaskPriority = "sem" | "baixa" | "media" | "alta" | "urgente";

import type { AgencyId } from "@/lib/agency/types";

/**
 * Um comentário da aba ATIVIDADE da tela de descrição da tarefa. O autor vem
 * da sessão do servidor — nunca do corpo da requisição —, como o `creator`.
 */
export type TaskComment = {
  id: string;
  /** Nome de quem escreveu, como estava na sessão no momento do envio. */
  author: string;
  text: string;
  /** ISO date */
  createdAt: string;
};

export type Task = {
  id: string;
  /**
   * Agência dona da tarefa. Vem sempre do escopo da sessão, nunca da
   * requisição — ver `repository.ts`.
   */
  agencyId: AgencyId;
  title: string;
  /** Cliente / contexto (linha secundária) */
  client: string;
  /**
   * O `Client.id` cujo nome bate com `client`, resolvido a cada gravação
   * (`resolveClientId`, em `lib/clients/repository.ts`). `null` quando o
   * texto está vazio ou não bate com nenhum cliente cadastrado — a tarefa
   * continua existindo, só sem o vínculo. Nunca vem do corpo da requisição.
   */
  clientId: string | null;
  status: TaskStatus;
  /**
   * Nome curto de quem toca a tarefa ("Felipe", "Marina"). A lista e o card
   * mostram avatar + nome, como o export desenha — a inicial do avatar sai
   * daqui, então gravar só a inicial deixaria a coluna repetindo "F F".
   */
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
  /**
   * ISO — quando a tarefa foi concluída; `null` fora de "Concluído". Gravado
   * pelo repositório na troca de status, nunca pelo corpo da requisição: é
   * ele que diz se a entrega saiu no prazo ("Tarefas no prazo", ficha do
   * cliente). Tarefa concluída antes deste campo existir fica sem a data.
   */
  completedAt: string | null;
  /** Conversa da tarefa, do mais antigo para o mais novo. */
  comments: TaskComment[];
  /**
   * O fluxo e a etapa em que a tarefa está (ver `lib/flows`). Concluir a
   * etapa entrega a tarefa ao responsável da próxima. `null` = tarefa solta.
   */
  flowId: string | null;
  stepId: string | null;
  /** O criativo que gerou a tarefa, quando ela nasceu de um lote. */
  source: { batchId: string; pieceId: string } | null;
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
  flowId?: string | null;
  stepId?: string | null;
  source?: { batchId: string; pieceId: string } | null;
};

/**
 * A agência fica de fora: tarefa não muda de dono por um PATCH. Os
 * comentários também — eles entram por `POST .../comments`, com o autor vindo
 * da sessão, e um PATCH que pudesse reescrever a conversa seria outra coisa.
 */
export type TaskPatch = Partial<
  Omit<
    Task,
    "id" | "createdAt" | "agencyId" | "comments" | "flowId" | "stepId" | "source" | "clientId" | "completedAt"
  >
>;

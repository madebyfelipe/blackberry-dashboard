import type { AgencyId } from "@/lib/agency/types";

/*
 * Inbox — a comunicação do time dentro do produto (issue #30).
 *
 * O que o desenho define, e este modelo segue à risca:
 *
 * - **Só o time da agência.** Não existe participante externo; toda conversa
 *   nasce escopada a uma agência, como tarefa e lote.
 * - **Grupo e direta**, como o Discord separa servidor de DM: as duas seções
 *   da lista ("GRUPOS" e "DIRETAS") são o mesmo registro com `kind` diferente.
 * - **Uma tela só.** Chat e chamada convivem: a chamada é uma ação de dentro
 *   da conversa e deixa rastro no histórico (a linha de sistema do export,
 *   "Marina iniciou uma chamada que durou 12 minutos").
 * - **O histórico fica salvo.** Mensagem é registro, não evento efêmero.
 */

/**
 * Disponibilidade de quem está no time. O símbolo de cada degrau é **forma**,
 * não matiz (`components/inbox/PresenceDot`): o produto é monocromático, e cor
 * com significado só existe onde o desenho mandou (ver `globals.css`).
 */
export type Presence = "disponivel" | "ocupado" | "ausente" | "offline";

export type ConversationKind = "grupo" | "direta";

/**
 * Alguém do time. Nasce de duas portas: o `seed` (a equipe da demonstração) e
 * `ensureMember`, que registra quem entra no app pela primeira vez — enquanto
 * não existir convite de equipe, é assim que a agência ganha gente.
 */
export type InboxMember = {
  id: string;
  agencyId: AgencyId;
  name: string;
  /** E-mail da conta. Vazio em quem veio do seed e nunca logou. */
  email: string;
  presence: Presence;
};

/**
 * `texto` é o que alguém escreveu. `chamada` e `aviso` são as duas linhas de
 * sistema do export (ícone + frase em cinza, sem avatar): a chamada que
 * aconteceu e o aviso do que mudou na conversa.
 */
export type MessageKind = "texto" | "chamada" | "aviso";

export type Message = {
  id: string;
  /** Id do membro que escreveu — nas linhas de sistema, quem provocou o evento. */
  authorId: string;
  text: string;
  /** ISO date */
  createdAt: string;
  kind: MessageKind;
};

export type Conversation = {
  id: string;
  /**
   * Agência dona da conversa. Vem sempre do escopo da sessão, nunca da
   * requisição — ver `repository.ts`.
   */
  agencyId: AgencyId;
  kind: ConversationKind;
  /** Nome do grupo. Na direta fica vazio: o título é quem está do outro lado. */
  name: string;
  memberIds: string[];
  /** Do mais antigo para o mais novo. */
  messages: Message[];
  /** Ids de quem silenciou a conversa (o sininho cortado da lista). */
  mutedBy: string[];
  /** Último instante lido, por membro (ISO). É daqui que sai o não lido. */
  readAt: Record<string, string>;
  /** ISO date */
  createdAt: string;
};

/** O arquivo inteiro: a equipe e as conversas dela. */
export type InboxData = {
  members: InboxMember[];
  conversations: Conversation[];
};

/**
 * A conversa como a lista precisa dela — já resolvida para quem está olhando
 * (título, prévia, não lidas, silenciada). Montada por `view.ts`, nunca
 * guardada: derivar é o que impede duas verdades sobre a mesma conversa.
 */
export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string;
  /**
   * As letras dos avatares: o grupo empilha duas (a marca do grupo na frente,
   * um membro atrás, como o export desenha); a direta traz uma só.
   */
  initials: string[];
  /** "Marina: fechei o export ok" — vazio quando ninguém escreveu ainda. */
  preview: string;
  /** ISO da última mensagem, ou `null` na conversa recém-criada. */
  lastAt: string | null;
  unread: number;
  muted: boolean;
  /** Presença de quem está do outro lado. `null` no grupo. */
  presence: Presence | null;
  memberCount: number;
  onlineCount: number;
};

/** A conversa aberta: o resumo + as mensagens e quem participa. */
export type ConversationDetail = ConversationSummary & {
  messages: Message[];
  members: InboxMember[];
};

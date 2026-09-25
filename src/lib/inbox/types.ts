import type { AgencyId } from "@/lib/agency/types";
import type { NotifyPrefs } from "./notifyPrefs";

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

/** A função na agência (coluna FUNÇÃO da tela de Usuários). */
export type MemberRole = "admin" | "gerente" | "editor" | "visualizador" | "financeiro";

/**
 * Onde a pessoa está no time: trabalhando, convidada e ainda sem conta,
 * afastada, ou fora (arquivada — o histórico dela fica, ela não recebe mais
 * nada).
 */
export type MemberStatus = "ativo" | "convite" | "inativo" | "arquivado";

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
  /**
   * O @ da pessoa, sem o "@" (`felipe`). Único dentro da agência — é por ele
   * que se menciona e atribui no Inbox, nas tarefas e nos comentários (ver
   * `handle.ts`).
   */
  handle: string;
  presence: Presence;
  role: MemberRole;
  status: MemberStatus;
  /** ISO — a última vez que abriu o produto. `null` = nunca entrou. */
  lastSeenAt: string | null;
  /** ISO — quando entrou no time (ou foi convidado). */
  createdAt: string;
  /**
   * O convite de quem ainda não tem conta. O token vai no link de cadastro
   * (`/criar-conta?convite=…`) e é o que coloca a pessoa **nesta** agência;
   * some quando ela entra.
   */
  invite: { token: string; agencyName: string; invitedBy: string } | null;
  /**
   * Chegou pelo domínio da agência (convite automático) e espera aprovação.
   * Enquanto `true`, a conta existe mas não enxerga nada da agência — ver
   * `memberAccess` e `lib/inbox/domain.ts`.
   */
  joinRequest: boolean;
  /**
   * O cargo, em texto livre ("Designer", "Social media", "Atendimento"). É o
   * que a ficha do cliente e o painel da agência mostram debaixo do nome. A
   * função (`role`) decide o acesso; o cargo só descreve o trabalho.
   */
  title: string;
  /** A foto (`/api/media/<id>`), ou `null` — sem foto, as iniciais. */
  photoUrl: string | null;
  /** O que avisa, por onde e com que som (Configurações › Pessoal). */
  notify: NotifyPrefs;
};

/** Ajustes do time de uma agência — hoje, o domínio do convite automático. */
export type TeamSettings = {
  /** "estudionorte.com" — `null` desliga o convite automático. */
  domain: string | null;
  /** A função com que o pedido entra quando aprovado. */
  domainRole: MemberRole;
};

/**
 * `texto` é o que alguém escreveu. `chamada` e `aviso` são as duas linhas de
 * sistema do export (ícone + frase em cinza, sem avatar): a chamada que
 * aconteceu e o aviso do que mudou na conversa.
 */
export type MessageKind = "texto" | "chamada" | "aviso";

/**
 * O que vai junto da mensagem. `imagem`, `video`, `audio` (inclusive o
 * gravado no próprio campo) e `arquivo` são bytes que o time subiu — servidos
 * por `/api/media/<id>`, como as artes. `gif` é da biblioteca (Giphy/Tenor) e
 * aponta para o CDN dela; o servidor só aceita esses endereços.
 */
export type AttachmentKind = "imagem" | "video" | "audio" | "arquivo" | "gif";

export type Attachment = {
  id: string;
  kind: AttachmentKind;
  url: string;
  name: string;
  mime: string;
  /** Bytes (0 no GIF, que não é nosso). */
  size: number;
  width?: number;
  height?: number;
  /** Só áudio: segundos, medidos no navegador de quem mandou (ver `voice.ts`). */
  duration?: number;
  /** Só áudio: as barras da forma de onda, de 0 a 100. */
  waveform?: number[];
};

export type Message = {
  id: string;
  /** Id do membro que escreveu — nas linhas de sistema, quem provocou o evento. */
  authorId: string;
  /** Pode ficar vazio quando a mensagem é só anexo, ou quando foi apagada. */
  text: string;
  /** ISO date */
  createdAt: string;
  kind: MessageKind;
  attachments: Attachment[];
  /** A mensagem que esta responde (o "responder" do menu). */
  replyToId: string | null;
  /** ISO da última edição — o "(editada)" ao lado da hora. */
  editedAt: string | null;
  /**
   * ISO de quando foi apagada. A linha fica ("mensagem apagada") para quem
   * respondeu a ela não ficar respondendo ao nada; texto e anexos somem.
   */
  deletedAt: string | null;
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
  /**
   * A chamada em curso, se houver. É o que faz o outro lado ver "chamada em
   * andamento" e poder entrar — sem isso, chamada seria coisa de quem já
   * estava com a tela aberta no segundo certo.
   *
   * Quem entra e quem sai grava aqui; a última pessoa a sair fecha a chamada
   * e deixa a linha no histórico, com o nome de quem começou. `seenAt` é o
   * último "ainda estou aqui" de cada um: quem para de dar sinal sai sozinho,
   * mesmo sem ter se despedido (ver `call.ts`).
   */
  call: {
    startedBy: string;
    startedAt: string;
    memberIds: string[];
    /** Último sinal de vida de cada participante (ISO). */
    seenAt: Record<string, string>;
  } | null;
  /** ISO date */
  createdAt: string;
};

/** O arquivo inteiro: a equipe e as conversas dela. */
export type InboxData = {
  members: InboxMember[];
  conversations: Conversation[];
  /** Por agência (`agencyId` → ajustes). */
  settings: Record<string, TeamSettings>;
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
  /** A foto de cada marca de `initials` (mesma ordem), ou `null` — aí vai a inicial. */
  photos: (string | null)[];
  /** "Marina: fechei o export ok" — vazio quando ninguém escreveu ainda. */
  preview: string;
  /** ISO da última mensagem, ou `null` na conversa recém-criada. */
  lastAt: string | null;
  unread: number;
  muted: boolean;
  /**
   * Presença de quem está do outro lado, como está **gravada**. `null` no
   * grupo. Com o tempo real ligado, a tela troca isso por quem está de fato
   * com o app aberto agora (ver `components/realtime`).
   */
  presence: Presence | null;
  /** Quem participa — a tela precisa dos ids para ler a presença ao vivo. */
  memberIds: string[];
  memberCount: number;
  onlineCount: number;
  /** Quem está na chamada desta conversa agora. Vazio = não há chamada. */
  callMemberIds: string[];
};

/** A conversa aberta: o resumo + as mensagens e quem participa. */
export type ConversationDetail = ConversationSummary & {
  messages: Message[];
  members: InboxMember[];
};

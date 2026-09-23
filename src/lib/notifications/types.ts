import type { AgencyId } from "@/lib/agency/types";

/*
 * Notificações — o que aconteceu com você no produto enquanto você estava
 * em outra coisa: alguém te marcou, uma tarefa chegou para você, uma
 * mensagem nova numa conversa sua.
 *
 * A notificação é de **uma pessoa** (o membro do time, como no Inbox), não
 * da conta: é o mesmo `InboxMember.id` que recebe tarefa de fluxo e está nas
 * conversas.
 */

/**
 * - `mencao`: alguém escreveu o seu @ (briefing, comentário ou mensagem).
 * - `atribuicao`: a tarefa passou a ser sua (na mão ou pelo fluxo).
 * - `comentario`: comentaram numa tarefa que é sua.
 * - `mensagem`: mensagem nova numa conversa sua — várias da mesma conversa,
 *   enquanto você não lê, viram uma notificação só (com o `count`).
 */
export type NotificationKind = "mencao" | "atribuicao" | "comentario" | "mensagem";

export type AppNotification = {
  id: string;
  agencyId: AgencyId;
  /** O membro do time que recebe. */
  recipientId: string;
  kind: NotificationKind;
  /** Quem provocou — o nome, como estava no momento ("black berry" quando foi o fluxo). */
  actor: string;
  /** "Marina te marcou em Post Montê bar". */
  title: string;
  /** Um trecho do que foi escrito (ou vazio). */
  body: string;
  /** Para onde o clique leva: `/tarefas/<id>` ou `/inbox?conversa=<id>`. */
  href: string;
  /**
   * Do que é a notificação — `tarefa:<id>` ou `conversa:<id>`. Abrir a
   * tarefa ou a conversa dá por lidas todas as notificações dela.
   */
  ref: string;
  /**
   * A mensagem que o aviso mostra (só nos avisos de conversa). É por ela que
   * editar troca o trecho e apagar o esconde — nunca pelo texto, que pode
   * repetir ("ok") ou já ter sido editado.
   */
  messageId?: string;
  /** Quantas mensagens a notificação resume (só `mensagem`; 1 no resto). */
  count: number;
  /** ISO — a mais recente do resumo. */
  createdAt: string;
  /** ISO, ou `null` enquanto não lida. */
  readAt: string | null;
};

/** O que quem avisa precisa dizer; id, agência e datas nascem no repositório. */
export type NotificationInput = Pick<
  AppNotification,
  "recipientId" | "kind" | "actor" | "title" | "body" | "href" | "ref" | "messageId"
>;

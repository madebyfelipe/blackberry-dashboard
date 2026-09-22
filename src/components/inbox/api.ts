import type {
  ConversationDetail,
  ConversationSummary,
  InboxMember,
  Presence,
} from "@/lib/inbox/types";

/** O que a tela do Inbox precisa saber de uma vez só. */
export type InboxSnapshot = {
  me: InboxMember;
  members: InboxMember[];
  conversations: ConversationSummary[];
};

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "Algo deu errado. Tente de novo.");
  }
  return data;
}

const json = (body: unknown): RequestInit => ({
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function apiInbox(): Promise<InboxSnapshot> {
  return (await parse(
    await fetch("/api/inbox", { cache: "no-store" }),
  )) as InboxSnapshot;
}

export async function apiConversation(id: string): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}`, { cache: "no-store" }),
  );
  return data.conversation as ConversationDetail;
}

export async function apiSendMessage(
  id: string,
  text: string,
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/messages`, {
      method: "POST",
      ...json({ text }),
    }),
  );
  return data.conversation as ConversationDetail;
}

/** O que o navegador precisa para entrar na sala da chamada. */
export type CallMedia = { url: string; token: string; room: string };

/**
 * Entra na chamada da conversa: registra que você está nela (para quem
 * abrir depois poder entrar) e devolve o crachá do LiveKit. `media` vem
 * nulo quando o ambiente não tem provedor de mídia configurado — a chamada
 * ainda abre, só não transmite.
 */
export async function apiJoinCall(
  id: string,
): Promise<{ conversation: ConversationDetail; media: CallMedia | null }> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/call`, { method: "POST" }),
  );
  return data as { conversation: ConversationDetail; media: CallMedia | null };
}

/** Sai da chamada. Quem sai por último fecha, e a linha entra no histórico. */
export async function apiLeaveCall(id: string): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/call`, { method: "DELETE" }),
  );
  return data.conversation as ConversationDetail;
}

export async function apiPatchConversation(
  id: string,
  patch: { read?: boolean; muted?: boolean },
): Promise<ConversationSummary> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}`, {
      method: "PATCH",
      ...json(patch),
    }),
  );
  return data.conversation as ConversationSummary;
}

export async function apiOpenDirect(
  memberId: string,
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch("/api/inbox/conversations", {
      method: "POST",
      ...json({ memberId }),
    }),
  );
  return data.conversation as ConversationDetail;
}

/** Só a sua disponibilidade — o menu da conta abre com ela marcada. */
export async function apiMyPresence(): Promise<InboxMember> {
  const data = await parse(
    await fetch("/api/inbox/presence", { cache: "no-store" }),
  );
  return data.me as InboxMember;
}

export async function apiSetPresence(presence: Presence): Promise<InboxMember> {
  const data = await parse(
    await fetch("/api/inbox/presence", { method: "PATCH", ...json({ presence }) }),
  );
  return data.me as InboxMember;
}

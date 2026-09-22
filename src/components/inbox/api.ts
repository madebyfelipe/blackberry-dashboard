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

/** Registra no histórico a chamada que acabou de terminar. */
export async function apiRegisterCall(
  id: string,
  seconds: number,
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/calls`, {
      method: "POST",
      ...json({ seconds }),
    }),
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

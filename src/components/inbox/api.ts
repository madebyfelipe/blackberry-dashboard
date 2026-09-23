import type {
  Attachment,
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

/** O que acompanha o texto: anexos já subidos, o GIF escolhido e a resposta. */
export type OutgoingExtra = {
  attachments?: Attachment[];
  gif?: GifResult | null;
  replyToId?: string | null;
};

export async function apiSendMessage(
  id: string,
  text: string,
  extra: OutgoingExtra = {},
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/messages`, {
      method: "POST",
      ...json({
        text,
        attachmentIds: (extra.attachments ?? []).map((a) => a.id),
        gif: extra.gif
          ? { url: extra.gif.url, width: extra.gif.width, height: extra.gif.height, title: extra.gif.title }
          : undefined,
        replyToId: extra.replyToId ?? undefined,
      }),
    }),
  );
  return data.conversation as ConversationDetail;
}

export async function apiEditMessage(
  id: string,
  messageId: string,
  text: string,
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/messages/${messageId}`, {
      method: "PATCH",
      ...json({ text }),
    }),
  );
  return data.conversation as ConversationDetail;
}

export async function apiDeleteMessage(id: string, messageId: string): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/messages/${messageId}`, { method: "DELETE" }),
  );
  return data.conversation as ConversationDetail;
}

/**
 * Sobe um anexo e devolve o que a mensagem vai levar. Com Blob configurado
 * (produção) o arquivo vai direto do navegador para o store — é o que deixa
 * passar arquivo acima de 4,5 MB, o corte da Vercel no corpo da requisição.
 * Sem Blob (dev local), multipart pela rota.
 */
export async function apiUploadAttachment(
  id: string,
  file: File,
  blobUploads: boolean,
): Promise<Attachment> {
  const endpoint = `/api/inbox/conversations/${id}/anexos`;
  let res: Response;
  if (blobUploads) {
    const [{ upload }, { blobPathnameFor, BLOB_ATTACHMENT_PREFIX, BLOB_MULTIPART_THRESHOLD, baseMime }] =
      await Promise.all([import("@vercel/blob/client"), import("@/lib/media/constants")]);
    const type = baseMime(file.type);
    const blob = await upload(blobPathnameFor(file.name, type, BLOB_ATTACHMENT_PREFIX), file, {
      access: "public",
      contentType: type,
      handleUploadUrl: `${endpoint}/token`,
      multipart: file.size > BLOB_MULTIPART_THRESHOLD,
    });
    res = await fetch(endpoint, { method: "POST", ...json({ pathname: blob.pathname, name: file.name }) });
  } else {
    const form = new FormData();
    form.append("file", file);
    res = await fetch(endpoint, { method: "POST", body: form });
  }
  const data = await parse(res);
  return data.attachment as Attachment;
}

/** Um GIF da biblioteca, como a busca devolve. */
export type GifResult = {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
  title: string;
};

export async function apiSearchGifs(q: string): Promise<GifResult[]> {
  const data = await parse(
    await fetch(`/api/inbox/gifs?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
  );
  return (data.results ?? []) as GifResult[];
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

/**
 * O "ainda estou aqui" da chamada. `inCall` falso quer dizer que o servidor
 * já te deu como fora (ficou tempo demais sem sinal).
 */
export async function apiTouchCall(id: string): Promise<{ inCall: boolean }> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/call`, { method: "PATCH" }),
  );
  return data as { inCall: boolean };
}

/**
 * Sai da chamada sem esperar resposta — para quando a página está indo
 * embora (aba fechando, troca de tela). `keepalive` faz o navegador terminar
 * de mandar o pedido mesmo depois de a página morrer.
 */
export function leaveCallOnExit(id: string): void {
  try {
    void fetch(`/api/inbox/conversations/${id}/call`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Página já desmontando: não há mais o que fazer daqui.
  }
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

/** Um grupo com você e essas pessoas (o "adicionar alguém" de uma direta). */
export async function apiCreateGroup(memberIds: string[]): Promise<ConversationDetail> {
  const data = await parse(
    await fetch("/api/inbox/conversations", {
      method: "POST",
      ...json({ memberIds }),
    }),
  );
  return data.conversation as ConversationDetail;
}

/** Traz alguém do time para um grupo de que você participa. */
export async function apiAddMember(
  id: string,
  memberId: string,
): Promise<ConversationDetail> {
  const data = await parse(
    await fetch(`/api/inbox/conversations/${id}/members`, {
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

import type { Presence } from "./types";

/*
 * A régua de presença do Inbox. Mesma forma das outras réguas do produto
 * (`tasks/constants.ts`, `clients/constants.ts`): a escala mora aqui e mais
 * lugar nenhum, e a cor é sempre `var(--token)` de `globals.css` — nunca hex
 * (ver `tests/design-tokens.test.ts`).
 *
 * Os quatro degraus são os que o Felipe pediu na issue #30: disponível, busy,
 * away e offline. O que distingue um do outro na tela é a **forma** do
 * símbolo, não o matiz: disco cheio, disco com corte, meia-lua e anel vazado.
 * O produto é monocromático — matiz novo só entra com desenho.
 */
export const PRESENCES: {
  id: Presence;
  label: string;
  /** `var(--token)` — o cinza do símbolo. */
  color: string;
}[] = [
  { id: "disponivel", label: "Disponível", color: "var(--color-presence-on)" },
  { id: "ocupado", label: "Ocupado", color: "var(--color-presence-busy)" },
  { id: "ausente", label: "Ausente", color: "var(--color-presence-away)" },
  { id: "offline", label: "Offline", color: "var(--color-presence-off)" },
];

export const PRESENCE_BY_ID: Record<Presence, (typeof PRESENCES)[number]> =
  Object.fromEntries(PRESENCES.map((p) => [p.id, p])) as Record<
    Presence,
    (typeof PRESENCES)[number]
  >;

export function isPresence(value: unknown): value is Presence {
  return PRESENCES.some((p) => p.id === value);
}

/** "Online" no cabeçalho do grupo é quem não está offline. */
export function isOnline(presence: Presence): boolean {
  return presence !== "offline";
}

/** O que cabe numa mensagem. O composer corta antes; a API recusa depois. */
export const MESSAGE_MAX = 4000;

/**
 * Até quando quem escreveu pode editar ou apagar a mensagem. Depois disso ela
 * é registro: alguém já pode ter lido e agido em cima dela.
 */
export const MESSAGE_EDIT_WINDOW_MS = 10 * 60_000;

/** Quantos anexos cabem numa mensagem. */
export const ATTACHMENTS_MAX = 10;

/** A mensagem ainda pode ser editada/apagada por quem a escreveu? */
export function canChangeMessage(
  message: { authorId: string; kind: string; createdAt: string; deletedAt: string | null },
  viewerId: string,
  now = Date.now(),
): boolean {
  if (message.kind !== "texto" || message.deletedAt || message.authorId !== viewerId) return false;
  const at = Date.parse(message.createdAt);
  return !Number.isNaN(at) && now - at <= MESSAGE_EDIT_WINDOW_MS;
}

/**
 * Os endereços de GIF aceitos: só o CDN do Giphy e o do Tenor, em https. É o
 * único anexo que aponta para fora — e é exatamente por isso que a lista é
 * fechada, em vez de aceitar qualquer URL que o navegador mandar.
 */
export function isGifUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      /^(media\d*|i)\.giphy\.com$/.test(host) ||
      host === "media.tenor.com" ||
      /^c\.tenor\.com$/.test(host)
    );
  } catch {
    return false;
  }
}

/** O que a prévia e a notificação dizem de uma mensagem só com anexo. */
export function attachmentsLabel(attachments: { kind: string; name: string }[]): string {
  if (attachments.length === 0) return "";
  const first = attachments[0];
  const more = attachments.length > 1 ? ` (+${attachments.length - 1})` : "";
  if (first.kind === "audio") return `Mensagem de voz${more}`;
  if (first.kind === "gif") return `GIF${more}`;
  if (first.kind === "imagem") return `Imagem${more}`;
  if (first.kind === "video") return `Vídeo${more}`;
  return `Arquivo: ${first.name}${more}`;
}

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

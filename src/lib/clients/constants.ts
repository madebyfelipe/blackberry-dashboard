import type { ClientStatus } from "./types";

export type ClientStatusMeta = {
  id: ClientStatus;
  label: string;
  /** Fundo do selo — `var(--token)`, nunca hex (ver `tests/design-tokens.test.ts`). */
  badgeBg: string;
  /** Texto do selo — `var(--token)`. */
  badgeFg: string;
};

/**
 * A régua de saúde do cliente. Fonte única, como `tasks/constants.ts` é para o
 * pipeline da tarefa: abas, selos e filtros saem daqui e desta ordem. Para
 * mudar a régua, mexe-se só neste arquivo.
 *
 * Os seis degraus e os seis pares de cor são os do export "Clientes · Painel".
 */
export const CLIENT_STATUSES: ClientStatusMeta[] = [
  {
    id: "ativo",
    label: "Ativo",
    badgeBg: "var(--color-client-ativo-bg)",
    badgeFg: "var(--color-client-ativo-fg)",
  },
  {
    id: "renovacao",
    label: "Renovação",
    badgeBg: "var(--color-client-renovacao-bg)",
    badgeFg: "var(--color-client-renovacao-fg)",
  },
  {
    id: "risco",
    label: "Em risco",
    badgeBg: "var(--color-client-risco-bg)",
    badgeFg: "var(--color-client-risco-fg)",
  },
  {
    id: "pausado",
    label: "Pausado",
    badgeBg: "var(--color-client-pausado-bg)",
    badgeFg: "var(--color-client-pausado-fg)",
  },
  {
    id: "novo",
    label: "Novo",
    badgeBg: "var(--color-client-novo-bg)",
    badgeFg: "var(--color-client-novo-fg)",
  },
  {
    id: "vip",
    label: "VIP",
    badgeBg: "var(--color-client-vip-bg)",
    badgeFg: "var(--color-client-vip-fg)",
  },
];

export const CLIENT_STATUS_BY_ID: Record<ClientStatus, ClientStatusMeta> =
  Object.fromEntries(CLIENT_STATUSES.map((s) => [s.id, s])) as Record<
    ClientStatus,
    ClientStatusMeta
  >;

export function isClientStatus(v: unknown): v is ClientStatus {
  return typeof v === "string" && v in CLIENT_STATUS_BY_ID;
}

export function clientStatusLabel(id: ClientStatus): string {
  return CLIENT_STATUS_BY_ID[id]?.label ?? id;
}

/**
 * "Dia 12" — a célula FATURAMENTO. Sem dia definido a tabela mostra o traço
 * de sempre, não um dia inventado.
 */
export function billingLabel(day: number | null): string {
  return day === null ? "—" : `Dia ${String(day).padStart(2, "0")}`;
}

/**
 * "Instagram, Blog +1" — a célula SERVIÇOS mostra dois e conta o resto, como
 * no export.
 */
export function servicesLabel(services: string[], visible = 2): string {
  if (services.length === 0) return "—";
  const head = services.slice(0, visible).join(", ");
  const rest = services.length - visible;
  return rest > 0 ? `${head} +${rest}` : head;
}

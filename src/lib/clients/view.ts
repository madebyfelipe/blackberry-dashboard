import type { Client, ClientStatus } from "./types";

/*
 * O que a tela de Clientes filtra e como ela se mostra. Mesmo desenho de
 * `lib/tasks/view.ts`: a view não guarda regra nenhuma, só lê daqui.
 *
 * As dimensões de filtro são as colunas do export — status, segmento,
 * responsável e serviço. Nada além do que o cliente realmente tem.
 */

export type ClientView = "lista" | "grade";

export type ClientSortKey = "az" | "za" | "faturamento" | "recentes";

export type ClientFilters = {
  status: ClientStatus[];
  segment: string[];
  owner: string[];
  service: string[];
};

export type ClientDisplay = {
  view: ClientView;
  sort: ClientSortKey;
};

export const EMPTY_CLIENT_FILTERS: ClientFilters = {
  status: [],
  segment: [],
  owner: [],
  service: [],
};

export const DEFAULT_CLIENT_DISPLAY: ClientDisplay = {
  view: "lista",
  sort: "az",
};

export const CLIENT_SORT_OPTIONS: { id: ClientSortKey; label: string }[] = [
  { id: "az", label: "Nome (A–Z)" },
  { id: "za", label: "Nome (Z–A)" },
  { id: "faturamento", label: "Dia do faturamento" },
  { id: "recentes", label: "Mais recentes" },
];

export function countActiveClientFilters(f: ClientFilters): number {
  return (
    f.status.length + f.segment.length + f.owner.length + f.service.length
  );
}

/** Valores distintos de uma dimensão, para montar as listas do menu. */
export function distinctValues(
  clients: Client[],
  key: "segment" | "owner",
): string[] {
  const set = new Set<string>();
  for (const c of clients) {
    const v = c[key]?.trim();
    if (v && v !== "—") set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function distinctServices(clients: Client[]): string[] {
  const set = new Set<string>();
  for (const c of clients) for (const s of c.services) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** A busca olha nome, segmento, responsável e serviços — o que a linha mostra. */
function matchesSearch(c: Client, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.segment, c.owner, ...c.services]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function applyClientFilters(
  clients: Client[],
  filters: ClientFilters,
  search: string,
): Client[] {
  return clients.filter((c) => {
    if (filters.status.length && !filters.status.includes(c.status)) return false;
    if (filters.segment.length && !filters.segment.includes(c.segment)) return false;
    if (filters.owner.length && !filters.owner.includes(c.owner)) return false;
    if (
      filters.service.length &&
      !c.services.some((s) => filters.service.includes(s))
    ) {
      return false;
    }
    return matchesSearch(c, search);
  });
}

export function sortClients(
  clients: Client[],
  display: ClientDisplay,
): Client[] {
  const out = [...clients];
  switch (display.sort) {
    case "za":
      return out.sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
    case "faturamento":
      // Sem dia definido vai para o fim — não é "dia 0".
      return out.sort(
        (a, b) => (a.billingDay ?? 99) - (b.billingDay ?? 99) ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
    case "recentes":
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "az":
    default:
      return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
}

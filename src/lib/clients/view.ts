import type { Client, ClientStatus } from "./types";
import { CLIENT_STATUSES, CLIENT_STATUS_BY_ID } from "./constants";

/*
 * O que a tela de Clientes filtra e como ela se mostra. Mesmo desenho de
 * `lib/tasks/view.ts`: a view não guarda regra nenhuma, só lê daqui.
 *
 * As dimensões de filtro são as colunas do export — status, segmento,
 * responsável e serviço. Nada além do que o cliente realmente tem.
 */

export type ClientView = "lista" | "grade";

export type ClientSortKey = "az" | "za" | "faturamento" | "recentes";

/** Agrupamento da lista (menu "Visualização", seção Organização). */
export type ClientGroupKey = "nenhum" | "status" | "segment" | "owner";

/**
 * Colunas que a lista pode mostrar.
 *
 * São as do export "Clientes · Painel (Lista)" mais CRIADO EM, que o menu de
 * visualização desenha como chip apagado. Os outros chips apagados do desenho
 * (Vencimento, Renovação, Risco, Tags, Atualizado em) ficam de fora porque o
 * cliente não tem esses campos — chip que não liga nada é pior que chip que
 * não existe, e inventar o campo criaria dado fictício para migrar depois
 * (ver `ROADMAP.md`).
 */
export type ClientColumnKey =
  | "status"
  | "segment"
  | "services"
  | "owner"
  | "billing"
  | "createdAt";

export type ClientFilters = {
  status: ClientStatus[];
  segment: string[];
  owner: string[];
  service: string[];
};

export type ClientDisplay = {
  view: ClientView;
  group: ClientGroupKey;
  sort: ClientSortKey;
  /**
   * "Mostrar arquivados": o cliente não tem estado de arquivo, e o degrau que
   * faz esse papel na carteira é Pausado — desligado, a lista esconde os
   * pausados. Quando existir arquivamento de verdade, é aqui que ele entra.
   */
  showArchived: boolean;
  /** "Mostrar grupos vazios": só muda algo quando há agrupamento por status. */
  showEmptyGroups: boolean;
  columns: ClientColumnKey[];
};

export const EMPTY_CLIENT_FILTERS: ClientFilters = {
  status: [],
  segment: [],
  owner: [],
  service: [],
};

export const DEFAULT_CLIENT_DISPLAY: ClientDisplay = {
  view: "lista",
  group: "nenhum",
  sort: "az",
  showArchived: true,
  showEmptyGroups: false,
  // Os cinco chips acesos do export, na ordem em que a lista os desenha.
  columns: ["segment", "services", "owner", "billing", "status"],
};

export const CLIENT_GROUP_OPTIONS: { id: ClientGroupKey; label: string }[] = [
  { id: "nenhum", label: "Nenhum" },
  { id: "status", label: "Status" },
  { id: "segment", label: "Segmento" },
  { id: "owner", label: "Responsável" },
];

export const CLIENT_COLUMN_OPTIONS: { id: ClientColumnKey; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "segment", label: "Segmento" },
  { id: "services", label: "Serviços" },
  { id: "owner", label: "Responsável" },
  { id: "billing", label: "Faturamento" },
  { id: "createdAt", label: "Criado em" },
];

export function toggleClientColumn(
  columns: ClientColumnKey[],
  id: ClientColumnKey,
): ClientColumnKey[] {
  return columns.includes(id)
    ? columns.filter((c) => c !== id)
    : [...columns, id];
}

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

/**
 * A busca olha o que a linha mostra — nome, segmento, responsável, serviços —
 * e também o contato do cartão de hover: procurar cliente pela cidade ou pelo
 * e-mail é exatamente o que se faz quando só isso se lembra.
 */
function matchesSearch(c: Client, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.segment, c.owner, c.city, c.email, c.phone, ...c.services]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function applyClientFilters(
  clients: Client[],
  filters: ClientFilters,
  search: string,
  display?: Pick<ClientDisplay, "showArchived">,
): Client[] {
  return clients.filter((c) => {
    if (display && !display.showArchived && c.status === "pausado") return false;
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

/* ------------------------------------------------------------- agrupamento */

export type ClientGroup = {
  key: string;
  label: string;
  clients: Client[];
};

const STATUS_ORDER = new Map(CLIENT_STATUSES.map((s, i) => [s.id, i]));

function groupOf(key: ClientGroupKey, c: Client): { key: string; label: string } {
  switch (key) {
    case "status":
      return { key: c.status, label: CLIENT_STATUS_BY_ID[c.status].label };
    case "segment":
      return {
        key: c.segment || "—",
        label: c.segment || "Sem segmento",
      };
    case "owner":
      return {
        key: c.owner || "—",
        label: c.owner === "—" || !c.owner ? "Sem responsável" : c.owner,
      };
    default:
      return { key: "todos", label: "Todos" };
  }
}

/**
 * Agrupa a lista. Por status a ordem é a da régua de saúde (não alfabética,
 * que embaralharia "Ativo" com "Em risco"); nas outras dimensões, alfabética.
 */
export function groupClients(
  clients: Client[],
  key: ClientGroupKey,
  opts?: { showEmpty?: boolean },
): ClientGroup[] {
  if (key === "nenhum") return [{ key: "todos", label: "Todos", clients }];

  const map = new Map<string, ClientGroup>();
  if (key === "status" && opts?.showEmpty) {
    for (const s of CLIENT_STATUSES) {
      map.set(s.id, { key: s.id, label: s.label, clients: [] });
    }
  }
  for (const c of clients) {
    const { key: k, label } = groupOf(key, c);
    const g = map.get(k) ?? { key: k, label, clients: [] };
    g.clients.push(c);
    map.set(k, g);
  }

  const groups = [...map.values()];
  if (key === "status") {
    groups.sort(
      (a, b) =>
        (STATUS_ORDER.get(a.key as ClientStatus) ?? 99) -
        (STATUS_ORDER.get(b.key as ClientStatus) ?? 99),
    );
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  return opts?.showEmpty ? groups : groups.filter((g) => g.clients.length > 0);
}

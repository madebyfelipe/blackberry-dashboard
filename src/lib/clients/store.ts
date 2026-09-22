import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import { isClientStatus } from "./constants";
import { seedClients } from "./seed";
import type { Client } from "./types";

/*
 * Armazenamento dos clientes. Mesma arquitetura das outras áreas: o app só
 * conversa com `repository.ts`, que só conversa com este arquivo, e o backend
 * (arquivo local ou Postgres) é escolhido em `lib/store/index.ts` por
 * `DATABASE_URL`.
 */

/** Migração de leitura: o que faltar entra com o padrão, como nas tarefas. */
function normalize(raw: Partial<Client> & { id: string }): Client {
  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
    name: raw.name ?? "",
    segment: raw.segment ?? "",
    services: Array.isArray(raw.services) ? raw.services.filter(Boolean) : [],
    city: raw.city ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    owner: raw.owner ?? "—",
    billingDay: typeof raw.billingDay === "number" ? raw.billingDay : null,
    status: isClientStatus(raw.status) ? raw.status : "ativo",
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

const store = createStore<Client[]>({
  file: "clients.json",
  seed: seedClients,
  revive: (raw) => (raw as (Partial<Client> & { id: string })[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

import { read, transaction } from "./store";
import { isClientStatus } from "./constants";
import type { AgencyScope } from "@/lib/agency/types";
import type { Client, ClientPatch, NewClient } from "./types";

/*
 * Tudo que o app faz com cliente passa por aqui.
 *
 * Mesmas regras do `tasks/repository.ts`: toda função exige o `AgencyScope`
 * como primeiro argumento, e o escopo só nasce da sessão do servidor
 * (`auth/session.ts`). Buscar por id sem conferir o dono é o furo clássico,
 * então `getClient`, `updateClient` e `deleteClient` procuram por id *e*
 * agência — registro de outra agência responde como inexistente (404), nunca
 * 403, que confirmaria que o id existe.
 */

export async function listClients(scope: AgencyScope): Promise<Client[]> {
  return (await read())
    .filter((c) => c.agencyId === scope.agencyId)
    // A tela lista em ordem alfabética, como o export desenha.
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getClient(
  scope: AgencyScope,
  id: string,
): Promise<Client | undefined> {
  return (await read()).find(
    (c) => c.id === id && c.agencyId === scope.agencyId,
  );
}

function makeId(): string {
  return "c" + Math.random().toString(36).slice(2, 9);
}

/** Serviços: sem espaço sobrando, sem repetição, no máximo 8. */
function cleanServices(input: unknown): string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const out: string[] = [];
  for (const raw of list) {
    const service = String(raw).trim().slice(0, 32);
    if (service && !out.includes(service)) out.push(service);
    if (out.length === 8) break;
  }
  return out;
}

/** Contato: texto curto e limpo. Campo vazio continua vazio. */
function cleanContact(value: unknown, max = 80): string {
  return value === undefined || value === null
    ? ""
    : String(value).trim().slice(0, max);
}

/**
 * E-mail: vazio passa (a ficha não exige contato), preenchido tem de parecer
 * e-mail. Sem regex de RFC — só o suficiente para pegar o erro de digitação
 * antes de ele virar um contato que ninguém alcança.
 */
function cleanEmail(value: unknown): string {
  const email = cleanContact(value, 160);
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("E-mail inválido.");
  }
  return email;
}

/** Dia do faturamento: 1–31 ou `null`. Fora da faixa é erro, não silêncio. */
function cleanBillingDay(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new ValidationError("Dia do faturamento deve ficar entre 1 e 31.");
  }
  return day;
}

export async function createClient(
  scope: AgencyScope,
  input: NewClient,
): Promise<Client> {
  const name = input.name?.trim();
  if (!name) throw new ValidationError("Nome é obrigatório.");
  const billingDay = cleanBillingDay(input.billingDay);
  const email = cleanEmail(input.email);

  const client: Client = {
    id: makeId(),
    // Dona é a agência da sessão. `NewClient` nem tem o campo.
    agencyId: scope.agencyId,
    name,
    segment: (input.segment ?? "").trim(),
    services: cleanServices(input.services),
    city: cleanContact(input.city),
    email,
    phone: cleanContact(input.phone, 40),
    owner: (input.owner ?? "").trim() || "—",
    billingDay,
    status: isClientStatus(input.status) ? input.status : "novo",
    createdAt: new Date().toISOString(),
  };

  return transaction((clients) => {
    clients.push(client);
    return client;
  });
}

export async function updateClient(
  scope: AgencyScope,
  id: string,
  patch: ClientPatch,
): Promise<Client | undefined> {
  if (patch.status !== undefined && !isClientStatus(patch.status)) {
    throw new ValidationError("Status inválido.");
  }
  if (patch.name !== undefined && !patch.name.trim()) {
    throw new ValidationError("Nome não pode ficar vazio.");
  }
  // Valida antes de abrir a transação.
  const billingDay =
    patch.billingDay === undefined ? undefined : cleanBillingDay(patch.billingDay);
  const email = patch.email === undefined ? undefined : cleanEmail(patch.email);

  return transaction((clients) => {
    const c = clients.find(
      (x) => x.id === id && x.agencyId === scope.agencyId,
    );
    if (!c) return undefined;
    if (patch.name !== undefined) c.name = patch.name.trim();
    if (patch.segment !== undefined) c.segment = patch.segment.trim();
    if (patch.services !== undefined) c.services = cleanServices(patch.services);
    if (patch.city !== undefined) c.city = cleanContact(patch.city);
    if (email !== undefined) c.email = email;
    if (patch.phone !== undefined) c.phone = cleanContact(patch.phone, 40);
    if (patch.owner !== undefined) c.owner = patch.owner.trim() || "—";
    if (patch.status !== undefined) c.status = patch.status;
    if (billingDay !== undefined) c.billingDay = billingDay;
    return { ...c, services: [...c.services] };
  });
}

export async function deleteClient(
  scope: AgencyScope,
  id: string,
): Promise<boolean> {
  return transaction((clients) => {
    const i = clients.findIndex(
      (x) => x.id === id && x.agencyId === scope.agencyId,
    );
    if (i === -1) return false;
    clients.splice(i, 1);
    return true;
  });
}

export class ValidationError extends Error {}

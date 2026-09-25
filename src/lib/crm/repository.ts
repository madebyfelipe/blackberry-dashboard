import { read, transaction, normalizeContract, normalizeEvent, normalizePayment, normalizeService } from "./store";
import { CRM_LIMITS, isFileFolder, isPaymentKind, isServiceStatus } from "./constants";
import { blankAccount } from "./defaults";
import { monthKey, monthlyTotal, nextInvoice } from "./view";
import type { AgencyScope } from "@/lib/agency/types";
import type {
  ClientAccount,
  ClientEvent,
  ClientFile,
  ClientService,
  Contract,
  FileFolder,
  Invoice,
  InvoiceStatus,
  PaymentMethod,
} from "./types";

/*
 * Tudo que o app faz com a ficha do cliente passa por aqui. Mesma regra das
 * outras áreas: `AgencyScope` primeiro, vindo só da sessão, e a conta é
 * procurada por cliente **e** agência — a de outra agência não existe.
 *
 * Quem chama confere antes que o cliente é desta agência (`getClient`): a
 * conta nasce na primeira gravação, e nascer para um id de cliente alheio
 * seria só lixo, mas lixo que não precisa existir.
 */

export class ValidationError extends Error {}

function makeId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}

function copy(a: ClientAccount): ClientAccount {
  return structuredClone(a);
}

/** Todas as fichas gravadas da agência — o painel da agência soma daqui. */
export async function listAccounts(scope: AgencyScope): Promise<ClientAccount[]> {
  return (await read()).filter((a) => a.agencyId === scope.agencyId).map(copy);
}

export async function getAccount(scope: AgencyScope, clientId: string): Promise<ClientAccount> {
  const found = (await read()).find((a) => a.clientId === clientId && a.agencyId === scope.agencyId);
  return found ? copy(found) : blankAccount(scope.agencyId, clientId);
}

/** Abre a conta (criando se preciso) numa transação e devolve a cópia depois de `fn`. */
async function withAccount(
  scope: AgencyScope,
  clientId: string,
  fn: (a: ClientAccount) => void,
): Promise<ClientAccount> {
  return transaction((accounts) => {
    const existing = accounts.find((x) => x.clientId === clientId && x.agencyId === scope.agencyId);
    const a = existing ?? blankAccount(scope.agencyId, clientId);
    // `fn` valida antes de mexer: se recusar (lança), nada entra — nem a conta nova.
    fn(a);
    if (!existing) accounts.push(a);
    return copy(a);
  });
}

/* ================================================================ serviços */

export type ServiceInput = Partial<
  Pick<ClientService, "name" | "kind" | "scope" | "responsibleId" | "monthlyValue" | "status" | "quota" | "unit" | "delivered" | "stage">
>;

export async function addService(
  scope: AgencyScope,
  clientId: string,
  input: ServiceInput,
  now: Date = new Date(),
): Promise<ClientAccount> {
  if (!String(input.name ?? "").trim()) throw new ValidationError("Dê um nome ao serviço.");
  if (input.status !== undefined && !isServiceStatus(input.status)) throw new ValidationError("Status inválido.");
  const service = normalizeService({
    ...input,
    id: makeId("s"),
    deliveredMonth: monthKey(now),
    createdAt: now.toISOString(),
  });
  return withAccount(scope, clientId, (a) => {
    if (a.services.length >= CRM_LIMITS.services) {
      throw new ValidationError(`Um cliente vai até ${CRM_LIMITS.services} serviços.`);
    }
    a.services.push(service);
  });
}

/**
 * Edita o serviço. Mexer nas entregas grava de que mês elas são — virar o
 * mês zera a contagem sozinho (ver `deliveredThisMonth`).
 */
export async function updateService(
  scope: AgencyScope,
  clientId: string,
  serviceId: string,
  patch: ServiceInput,
  now: Date = new Date(),
): Promise<ClientAccount | undefined> {
  if (patch.name !== undefined && !String(patch.name).trim()) throw new ValidationError("Dê um nome ao serviço.");
  if (patch.status !== undefined && !isServiceStatus(patch.status)) throw new ValidationError("Status inválido.");
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const i = a.services.findIndex((s) => s.id === serviceId);
    if (i === -1) return;
    found = true;
    const current = a.services[i];
    const touchedDeliveries = patch.delivered !== undefined || patch.quota !== undefined;
    a.services[i] = normalizeService({
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      deliveredMonth: touchedDeliveries ? monthKey(now) : current.deliveredMonth,
    });
  });
  return found ? account : undefined;
}

export async function removeService(
  scope: AgencyScope,
  clientId: string,
  serviceId: string,
): Promise<ClientAccount | undefined> {
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const before = a.services.length;
    a.services = a.services.filter((s) => s.id !== serviceId);
    found = a.services.length !== before;
  });
  return found ? account : undefined;
}

/* ================================================================ faturas */

/**
 * "Gerar cobrança": a fatura da próxima competência sem fatura, no valor dos
 * serviços faturados, vencendo no dia do faturamento, pela forma de
 * pagamento da ficha. Já existindo fatura em aberto, é ela — não duplica.
 */
export async function generateInvoice(
  scope: AgencyScope,
  clientId: string,
  opts: { billingDay: number | null; now?: Date },
): Promise<ClientAccount> {
  const now = opts.now ?? new Date();
  return withAccount(scope, clientId, (a) => {
    const mrr = monthlyTotal(a.services);
    const next = nextInvoice(a.invoices, mrr, opts.billingDay, now);
    if (next.existing) throw new ValidationError("Já existe uma cobrança em aberto — marque-a como paga antes de gerar outra.");
    if (!opts.billingDay || !next.dueDate || !next.competence) {
      throw new ValidationError("Defina o dia do faturamento na ficha do cliente para gerar a cobrança.");
    }
    if (mrr <= 0) throw new ValidationError("Nenhum serviço faturado — adicione um serviço antes de cobrar.");
    if (a.invoices.length >= CRM_LIMITS.invoices) throw new ValidationError("Histórico de faturas cheio.");
    const invoice: Invoice = {
      id: makeId("inv-"),
      competence: next.competence,
      dueDate: `${monthKey(next.dueDate)}-${String(next.dueDate.getDate()).padStart(2, "0")}`,
      amount: mrr,
      method: a.payment?.kind ?? "pix",
      status: "aberto",
      paidAt: null,
      createdAt: now.toISOString(),
    };
    a.invoices.push(invoice);
  });
}

export async function setInvoiceStatus(
  scope: AgencyScope,
  clientId: string,
  invoiceId: string,
  status: InvoiceStatus,
  now: Date = new Date(),
): Promise<ClientAccount | undefined> {
  if (status !== "pago" && status !== "aberto") throw new ValidationError("Status inválido.");
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const inv = a.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    found = true;
    inv.status = status;
    inv.paidAt = status === "pago" ? now.toISOString() : null;
  });
  return found ? account : undefined;
}

export async function removeInvoice(
  scope: AgencyScope,
  clientId: string,
  invoiceId: string,
): Promise<ClientAccount | undefined> {
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const before = a.invoices.length;
    a.invoices = a.invoices.filter((i) => i.id !== invoiceId);
    found = a.invoices.length !== before;
  });
  return found ? account : undefined;
}

/* ============================================== contrato e pagamento */

export async function updateContract(
  scope: AgencyScope,
  clientId: string,
  patch: { contract?: Partial<Contract>; payment?: Partial<PaymentMethod> | null },
): Promise<ClientAccount> {
  if (patch.payment && !isPaymentKind(patch.payment.kind)) throw new ValidationError("Forma de pagamento inválida.");
  const start = patch.contract?.startDate;
  if (start !== undefined && start !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(start))) {
    throw new ValidationError("Data de início inválida.");
  }
  if (patch.payment?.kind === "cartao") {
    const digits = String(patch.payment.last4 ?? "").replace(/\D/g, "");
    // Da ficha só sai o final: número inteiro de cartão não é guardado aqui.
    if (digits.length > 4) throw new ValidationError("Guarde só os 4 últimos dígitos do cartão.");
  }
  return withAccount(scope, clientId, (a) => {
    if (patch.contract) a.contract = normalizeContract({ ...a.contract, ...patch.contract });
    if (patch.payment !== undefined) a.payment = normalizePayment(patch.payment);
  });
}

/* ================================================================ arquivos */

export async function addFile(
  scope: AgencyScope,
  clientId: string,
  input: { mediaId: string; name: string; mime: string; size: number; folder: FileFolder; uploadedBy: string },
  now: Date = new Date(),
): Promise<ClientAccount> {
  if (!isFileFolder(input.folder)) throw new ValidationError("Pasta inválida.");
  const file: ClientFile = {
    id: makeId("f"),
    mediaId: input.mediaId,
    name: input.name.slice(0, 160) || "arquivo",
    mime: input.mime,
    size: input.size,
    folder: input.folder,
    uploadedBy: input.uploadedBy.slice(0, 60) || "—",
    createdAt: now.toISOString(),
  };
  return withAccount(scope, clientId, (a) => {
    if (a.files.length >= CRM_LIMITS.files) throw new ValidationError("Limite de arquivos do cliente atingido.");
    a.files.push(file);
  });
}

export async function moveFile(
  scope: AgencyScope,
  clientId: string,
  fileId: string,
  folder: FileFolder,
): Promise<ClientAccount | undefined> {
  if (!isFileFolder(folder)) throw new ValidationError("Pasta inválida.");
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const f = a.files.find((x) => x.id === fileId);
    if (!f) return;
    found = true;
    f.folder = folder;
  });
  return found ? account : undefined;
}

/** Tira o arquivo da ficha e devolve o `mediaId` — os bytes, quem chama apaga. */
export async function removeFile(
  scope: AgencyScope,
  clientId: string,
  fileId: string,
): Promise<{ account: ClientAccount; mediaId: string } | undefined> {
  let mediaId: string | null = null;
  const account = await withAccount(scope, clientId, (a) => {
    const f = a.files.find((x) => x.id === fileId);
    if (!f) return;
    mediaId = f.mediaId;
    a.files = a.files.filter((x) => x.id !== fileId);
  });
  return mediaId ? { account, mediaId } : undefined;
}

/* ================================================================== agenda */

export async function addEvent(
  scope: AgencyScope,
  clientId: string,
  input: Partial<Pick<ClientEvent, "kind" | "title" | "at" | "place">> & { createdBy: string },
  now: Date = new Date(),
): Promise<ClientAccount> {
  const event = normalizeEvent({ ...input, id: makeId("ev"), createdAt: now.toISOString() });
  if (!event) throw new ValidationError("O evento precisa de título, dia e hora.");
  return withAccount(scope, clientId, (a) => {
    if (a.events.length >= CRM_LIMITS.events) throw new ValidationError("Agenda do cliente cheia.");
    a.events.push(event);
  });
}

export async function removeEvent(
  scope: AgencyScope,
  clientId: string,
  eventId: string,
): Promise<ClientAccount | undefined> {
  let found = false;
  const account = await withAccount(scope, clientId, (a) => {
    const before = a.events.length;
    a.events = a.events.filter((e) => e.id !== eventId);
    found = a.events.length !== before;
  });
  return found ? account : undefined;
}

/**
 * O cliente saiu da carteira: a ficha vai junto. Devolve os `mediaId` dos
 * arquivos — os bytes, quem chama apaga.
 */
export async function deleteAccount(scope: AgencyScope, clientId: string): Promise<string[]> {
  return transaction((accounts) => {
    const i = accounts.findIndex((a) => a.clientId === clientId && a.agencyId === scope.agencyId);
    if (i === -1) return [];
    const [gone] = accounts.splice(i, 1);
    return gone.files.map((f) => f.mediaId);
  });
}

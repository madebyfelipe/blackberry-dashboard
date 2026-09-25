import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import {
  CRM_LIMITS,
  isContractCycle,
  isEventKind,
  isFileFolder,
  isPaymentKind,
  isServiceKind,
  isServiceStatus,
} from "./constants";
import { NO_CONTRACT } from "./defaults";
import { seedAccounts } from "./seed";
import type {
  ClientAccount,
  ClientEvent,
  ClientFile,
  ClientService,
  Contract,
  Invoice,
  PaymentMethod,
} from "./types";

/*
 * Armazenamento das fichas — mesma cadeia das outras áreas (`crm.json` ou a
 * linha "crm" do Postgres, ver `lib/store/index.ts`).
 *
 * As funções `normalize*` são a porta de validação: tudo que é lido do
 * disco **e** tudo que chega da API passa por elas, e sai inteiro, no
 * formato certo e dentro dos tetos.
 */

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cents(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, CRM_LIMITS.maxCents) : 0;
}

function count(v: unknown, max: number): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}

const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDay = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const iso = (v: unknown, fallback: string) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback;

export function normalizeService(raw: Partial<ClientService> & { id: string }): ClientService {
  const quota = raw.quota === null || raw.quota === undefined ? null : count(raw.quota, 999) || null;
  return {
    id: String(raw.id),
    name: text(raw.name, 60) || "Serviço",
    kind: isServiceKind(raw.kind) ? raw.kind : "outro",
    scope: text(raw.scope, 80),
    responsibleId: raw.responsibleId ? String(raw.responsibleId) : null,
    monthlyValue: cents(raw.monthlyValue),
    status: isServiceStatus(raw.status) ? raw.status : "ativo",
    quota,
    unit: quota ? text(raw.unit, 20) : "",
    delivered: quota ? Math.min(count(raw.delivered, 999), quota * 10) : 0,
    deliveredMonth: isMonth(raw.deliveredMonth) ? raw.deliveredMonth : "",
    stage: text(raw.stage, 40),
    createdAt: iso(raw.createdAt, new Date().toISOString()),
  };
}

export function normalizeInvoice(raw: Partial<Invoice> & { id: string }): Invoice | null {
  if (!isMonth(raw.competence) || !isDay(raw.dueDate)) return null;
  const paid = raw.status === "pago";
  return {
    id: String(raw.id),
    competence: raw.competence,
    dueDate: raw.dueDate,
    amount: cents(raw.amount),
    method: isPaymentKind(raw.method) ? raw.method : "pix",
    status: paid ? "pago" : "aberto",
    paidAt: paid ? iso(raw.paidAt, new Date().toISOString()) : null,
    createdAt: iso(raw.createdAt, new Date().toISOString()),
  };
}

export function normalizeContract(raw: Partial<Contract> | undefined | null): Contract {
  const r = raw ?? {};
  const months = r.fidelityMonths === null || r.fidelityMonths === undefined ? null : count(r.fidelityMonths, 120) || null;
  return {
    startDate: isDay(r.startDate) ? r.startDate : NO_CONTRACT.startDate,
    fidelityMonths: months,
    cycle: isContractCycle(r.cycle) ? r.cycle : NO_CONTRACT.cycle,
    adjustmentIndex: text(r.adjustmentIndex, 20),
  };
}

export function normalizePayment(raw: Partial<PaymentMethod> | undefined | null): PaymentMethod | null {
  if (!raw || !isPaymentKind(raw.kind)) return null;
  const card = raw.kind === "cartao";
  const last4 = String(raw.last4 ?? "").replace(/\D/g, "").slice(-4);
  const expires = String(raw.expires ?? "").trim();
  return {
    kind: raw.kind,
    brand: card ? text(raw.brand, 20) : "",
    last4: card ? last4 : "",
    expires: card && /^(0[1-9]|1[0-2])\/\d{2}$/.test(expires) ? expires : "",
  };
}

export function normalizeFile(raw: Partial<ClientFile> & { id: string }): ClientFile | null {
  if (!raw.mediaId) return null;
  return {
    id: String(raw.id),
    mediaId: String(raw.mediaId),
    name: text(raw.name, 160) || "arquivo",
    mime: text(raw.mime, 120),
    size: count(raw.size, Number.MAX_SAFE_INTEGER),
    folder: isFileFolder(raw.folder) ? raw.folder : "briefings",
    uploadedBy: text(raw.uploadedBy, 60) || "—",
    createdAt: iso(raw.createdAt, new Date().toISOString()),
  };
}

export function normalizeEvent(raw: Partial<ClientEvent> & { id: string }): ClientEvent | null {
  const title = text(raw.title, 80);
  if (!title || typeof raw.at !== "string" || Number.isNaN(Date.parse(raw.at))) return null;
  return {
    id: String(raw.id),
    kind: isEventKind(raw.kind) ? raw.kind : "outro",
    title,
    at: new Date(raw.at).toISOString(),
    place: text(raw.place, 60),
    createdBy: text(raw.createdBy, 60) || "—",
    createdAt: iso(raw.createdAt, new Date().toISOString()),
  };
}

function list<T, R>(raw: unknown, fn: (r: T) => R | null, max: number): R[] {
  if (!Array.isArray(raw)) return [];
  const out: R[] = [];
  const ids = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object" || !(r as { id?: unknown }).id) continue;
    const v = fn(r as T);
    const id = v && (v as unknown as { id: string }).id;
    if (!v || ids.has(id!)) continue;
    ids.add(id!);
    out.push(v);
    if (out.length === max) break;
  }
  return out;
}

export function normalizeAccount(raw: Partial<ClientAccount> & { clientId: string }): ClientAccount {
  return {
    clientId: String(raw.clientId),
    agencyId: agencyIdOrLegacy(raw.agencyId),
    contract: normalizeContract(raw.contract),
    payment: normalizePayment(raw.payment),
    services: list(raw.services, normalizeService, CRM_LIMITS.services),
    invoices: list(raw.invoices, normalizeInvoice, CRM_LIMITS.invoices),
    files: list(raw.files, normalizeFile, CRM_LIMITS.files),
    events: list(raw.events, normalizeEvent, CRM_LIMITS.events),
  };
}

const store = createStore<ClientAccount[]>({
  file: "crm.json",
  seed: () => seedAccounts(),
  revive: (raw) =>
    (Array.isArray(raw) ? raw : [])
      .filter((a): a is ClientAccount => !!a && typeof a === "object" && !!(a as ClientAccount).clientId)
      .map(normalizeAccount),
});

export const read = store.read;
export const transaction = store.transaction;

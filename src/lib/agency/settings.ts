import type { ContractCycle, PaymentKind } from "@/lib/crm/types";

/*
 * Os ajustes da agência inteira (Configurações › Agência): o logo e os
 * padrões que um cliente novo já recebe preenchidos. Regra pura, testada em
 * `tests/agency-settings.test.ts`; quem grava é `repository.ts`.
 *
 * O nome da agência não mora aqui: ele está em cada conta (`User.agency`) e
 * no escopo da sessão, e renomear passa por `renameAgency` (auth). O domínio
 * do convite automático também não — é do time (`TeamSettings`, no Inbox).
 */

export type ClientDefaults = {
  /** Dia do mês da cobrança, 1–31. `null` = sem padrão. */
  billingDay: number | null;
  /** "IPCA", "IGP-M"… Vazio = sem reajuste. */
  adjustmentIndex: string;
  /** Meses de fidelidade. 0 = contrato sem fidelidade. */
  fidelityMonths: number;
  /** `null` = a ficha nasce sem forma de pagamento. */
  paymentKind: PaymentKind | null;
  cycle: ContractCycle;
  /** O fluxo que o cliente novo já segue. `null` = o padrão da agência ("Todos os clientes"). */
  flowId: string | null;
};

export type AgencySettings = {
  /** `/api/media/<id>`, ou `null` — sem logo, as iniciais do nome. */
  logoUrl: string | null;
  clientDefaults: ClientDefaults;
};

/**
 * O padrão de quem nunca mexeu: nada preenchido. Assim cadastrar cliente
 * continua igual ao que era antes desta tela existir, até a agência escolher.
 */
export const DEFAULT_CLIENT_DEFAULTS: ClientDefaults = {
  billingDay: null,
  adjustmentIndex: "",
  fidelityMonths: 0,
  paymentKind: null,
  cycle: "mensal",
  flowId: null,
};

export const DEFAULT_AGENCY_SETTINGS: AgencySettings = {
  logoUrl: null,
  clientDefaults: DEFAULT_CLIENT_DEFAULTS,
};

export const PAYMENT_KINDS: { id: PaymentKind; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
];

export const CONTRACT_CYCLES: { id: ContractCycle; label: string }[] = [
  { id: "mensal", label: "Mensal" },
  { id: "trimestral", label: "Trimestral" },
  { id: "semestral", label: "Semestral" },
  { id: "anual", label: "Anual" },
];

/** Os índices que o campo oferece. O vazio é "Sem reajuste". */
export const ADJUSTMENT_INDEXES = ["IPCA", "IGP-M", "INPC", "INCC"];

const MEDIA_URL = /^\/api\/media\/[a-f0-9]{32}$/;

function isPaymentKind(v: unknown): v is PaymentKind {
  return PAYMENT_KINDS.some((p) => p.id === v);
}

function isCycle(v: unknown): v is ContractCycle {
  return CONTRACT_CYCLES.some((c) => c.id === v);
}

export class AgencySettingsError extends Error {}

/**
 * Os padrões como chegam da tela ou do arquivo. `strict` (a gravação) recusa
 * valor fora da régua com mensagem; sem ele (a leitura), o valor ruim vira o
 * padrão calado — arquivo velho nunca derruba a tela.
 */
export function normalizeClientDefaults(raw: unknown, strict = false): ClientDefaults {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fail = (msg: string) => {
    if (strict) throw new AgencySettingsError(msg);
  };

  let billingDay: number | null = null;
  if (r.billingDay !== null && r.billingDay !== undefined && r.billingDay !== "") {
    const d = Number(r.billingDay);
    if (Number.isInteger(d) && d >= 1 && d <= 31) billingDay = d;
    else fail("Dia de cobrança deve ficar entre 1 e 31.");
  }

  let fidelityMonths = 0;
  if (r.fidelityMonths !== null && r.fidelityMonths !== undefined && r.fidelityMonths !== "") {
    const m = Number(r.fidelityMonths);
    if (Number.isInteger(m) && m >= 0 && m <= 120) fidelityMonths = m;
    else fail("Fidelidade deve ficar entre 0 e 120 meses.");
  }

  let paymentKind: PaymentKind | null = null;
  if (r.paymentKind !== null && r.paymentKind !== undefined && r.paymentKind !== "") {
    if (isPaymentKind(r.paymentKind)) paymentKind = r.paymentKind;
    else fail("Forma de pagamento inválida.");
  }

  let cycle: ContractCycle = "mensal";
  if (r.cycle !== undefined) {
    if (isCycle(r.cycle)) cycle = r.cycle;
    else fail("Ciclo de contrato inválido.");
  }

  const flowId = typeof r.flowId === "string" && r.flowId.trim() ? r.flowId.trim() : null;

  return {
    billingDay,
    adjustmentIndex: String(r.adjustmentIndex ?? "").trim().slice(0, 20),
    fidelityMonths,
    paymentKind,
    cycle,
    flowId,
  };
}

export function normalizeAgencySettings(raw: unknown): AgencySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    logoUrl: typeof r.logoUrl === "string" && MEDIA_URL.test(r.logoUrl) ? r.logoUrl : null,
    clientDefaults: normalizeClientDefaults(r.clientDefaults),
  };
}

/** O logo só pode ser mídia do próprio app — nunca um endereço de fora. */
export function isMediaUrl(v: unknown): v is string {
  return typeof v === "string" && MEDIA_URL.test(v);
}

/**
 * O cadastro do cliente com os padrões da agência no que a pessoa não disse.
 * Só preenche o que veio vazio: o que foi escolhido na hora vale mais.
 */
export function withClientDefaults<T extends Record<string, unknown>>(
  input: T,
  defaults: ClientDefaults,
): T {
  const out = { ...input };
  const empty = (v: unknown) => v === undefined || v === null || v === "";
  const o = out as Record<string, unknown>;
  if (empty(o.billingDay) && defaults.billingDay !== null) o.billingDay = defaults.billingDay;
  if (empty(o.flowId) && defaults.flowId) o.flowId = defaults.flowId;
  return out;
}

/** O contrato e o pagamento que a ficha nova recebe — `null` quando não há o que gravar. */
export function contractFromDefaults(defaults: ClientDefaults): {
  contract: { cycle: ContractCycle; fidelityMonths: number | null; adjustmentIndex: string };
  payment: { kind: PaymentKind } | null;
} | null {
  const untouched =
    defaults.cycle === "mensal" &&
    defaults.fidelityMonths === 0 &&
    !defaults.adjustmentIndex &&
    !defaults.paymentKind;
  if (untouched) return null;
  return {
    contract: {
      cycle: defaults.cycle,
      fidelityMonths: defaults.fidelityMonths > 0 ? defaults.fidelityMonths : null,
      adjustmentIndex: defaults.adjustmentIndex,
    },
    payment: defaults.paymentKind ? { kind: defaults.paymentKind } : null,
  };
}

/** "Estúdio Norte" → "EN". O logo de quem ainda não mandou um. */
export function agencyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

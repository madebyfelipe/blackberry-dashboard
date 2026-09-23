import { createStore } from "@/lib/store";
import { agencyIdOrLegacy } from "@/lib/agency/id";
import { NO_AUTOMATIONS, isStepIcon } from "./constants";
import { seedFlows } from "./seed";
import { isFlowStatus } from "./view";
import type { Flow, FlowStep, StepAssignee, StepApprover } from "./types";

/*
 * Armazenamento dos fluxos — mesma cadeia das outras áreas: a tela fala com
 * `repository.ts`, que fala só com este arquivo, e `lib/store/index.ts`
 * decide entre Postgres e arquivo por `DATABASE_URL`.
 *
 * `normalizeStep` é também a porta de validação do que chega pela API: uma
 * etapa sai daqui sempre inteira, com cada campo no formato certo.
 */

function num(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null;
}

function normalizeAssignee(raw: unknown): StepAssignee {
  const a = (raw ?? {}) as Partial<{ kind: string; memberId: string }>;
  if (a.kind === "membro" && a.memberId) return { kind: "membro", memberId: String(a.memberId) };
  if (a.kind === "cliente") return { kind: "cliente" };
  return { kind: "squad" };
}

function normalizeApprovers(raw: unknown): StepApprover[] {
  if (!Array.isArray(raw)) return [];
  const out: StepApprover[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const a = r as Partial<StepApprover>;
    const memberId = a.memberId ? String(a.memberId) : null;
    if (out.some((x) => x.memberId === memberId)) continue;
    out.push({ memberId, required: !!a.required });
    if (out.length === 8) break;
  }
  return out;
}

export function normalizeStep(raw: Partial<FlowStep> & { id: string }): FlowStep {
  const automations = { ...NO_AUTOMATIONS };
  const rawAuto = (raw.automations ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(automations) as (keyof typeof automations)[]) {
    automations[k] = !!rawAuto[k];
  }
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").trim().slice(0, 40) || "Etapa",
    icon: isStepIcon(raw.icon) ? raw.icon : "file-text",
    assignee: normalizeAssignee(raw.assignee),
    backupId: raw.backupId ? String(raw.backupId) : null,
    slaDays: num(raw.slaDays, 90),
    alertDaysBefore: num(raw.alertDaysBefore, 30),
    entryStatus: String(raw.entryStatus ?? "").trim().slice(0, 40),
    exitStatus: String(raw.exitStatus ?? "").trim().slice(0, 40),
    approvers: normalizeApprovers(raw.approvers),
    automations,
    nextStepId: raw.nextStepId ? String(raw.nextStepId) : null,
    disabled: !!raw.disabled,
  };
}

function normalize(raw: Partial<Flow> & { id: string }): Flow {
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((s): s is FlowStep => !!s && typeof s === "object" && !!s.id)
    .map(normalizeStep);
  const ids = new Set(steps.map((s) => s.id));
  return {
    id: raw.id,
    agencyId: agencyIdOrLegacy(raw.agencyId),
    name: String(raw.name ?? "").trim() || "Fluxo",
    status: isFlowStatus(raw.status) ? raw.status : "ativo",
    // "Próxima" e "início" que apontam para etapa que não existe mais caem no padrão.
    steps: steps.map((s) => (s.nextStepId && !ids.has(s.nextStepId) ? { ...s, nextStepId: null } : s)),
    startStepId: raw.startStepId && ids.has(raw.startStepId) ? raw.startStepId : null,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
    updatedBy: String(raw.updatedBy ?? "—"),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

const store = createStore<Flow[]>({
  file: "flows.json",
  seed: seedFlows,
  revive: (raw) =>
    (Array.isArray(raw) ? raw : [])
      .filter((f): f is Flow => !!f && typeof f === "object" && !!(f as Flow).id)
      .map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

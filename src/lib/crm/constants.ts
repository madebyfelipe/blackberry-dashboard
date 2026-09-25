import type {
  ActivityKind,
  ContractCycle,
  EventKind,
  FileFolder,
  PaymentKind,
  ServiceKind,
  ServiceStatus,
} from "./types";

/*
 * As réguas fixas da ficha do cliente. Cor é sempre `var(--token)` — os
 * pares fundo/texto dos selos são a escala de saúde do cliente
 * (`--color-client-*`) e os tons dos arquivos e atividades vêm do export
 * "Clientes · Detalhe" (`--color-crm-*`, em `globals.css`).
 */

export const SERVICE_KINDS: { id: ServiceKind; label: string }[] = [
  { id: "instagram", label: "Redes sociais" },
  { id: "blog", label: "Blog / conteúdo escrito" },
  { id: "trafego", label: "Tráfego pago" },
  { id: "producao", label: "Produção (foto e vídeo)" },
  { id: "email", label: "E-mail marketing" },
  { id: "site", label: "Site" },
  { id: "design", label: "Design" },
  { id: "outro", label: "Outro" },
];

export function isServiceKind(v: unknown): v is ServiceKind {
  return SERVICE_KINDS.some((k) => k.id === v);
}

/** Os selos da coluna STATUS da aba Serviços — os mesmos pares da saúde do cliente. */
export const SERVICE_STATUSES: { id: ServiceStatus; label: string; bg: string; fg: string }[] = [
  { id: "ativo", label: "Ativo", bg: "var(--color-client-ativo-bg)", fg: "var(--color-crm-green)" },
  { id: "setup", label: "Em setup", bg: "var(--color-client-renovacao-bg)", fg: "var(--color-crm-amber)" },
  { id: "pausado", label: "Pausado", bg: "var(--color-client-pausado-bg)", fg: "var(--color-client-pausado-fg)" },
];

export function isServiceStatus(v: unknown): v is ServiceStatus {
  return SERVICE_STATUSES.some((s) => s.id === v);
}

export function serviceStatus(id: ServiceStatus) {
  return SERVICE_STATUSES.find((s) => s.id === id) ?? SERVICE_STATUSES[0];
}

export const PAYMENT_KINDS: { id: PaymentKind; label: string }[] = [
  { id: "cartao", label: "Cartão de crédito" },
  { id: "pix", label: "Pix" },
  { id: "boleto", label: "Boleto" },
  { id: "transferencia", label: "Transferência" },
];

export function isPaymentKind(v: unknown): v is PaymentKind {
  return PAYMENT_KINDS.some((k) => k.id === v);
}

export function paymentLabel(id: PaymentKind): string {
  return PAYMENT_KINDS.find((k) => k.id === id)?.label ?? "—";
}

/** "A vencer" · "Pago" · "Atrasado" — a coluna STATUS do histórico de faturas. */
export const INVOICE_BADGES = {
  "a-vencer": { label: "A vencer", bg: "var(--color-client-renovacao-bg)", fg: "var(--color-crm-amber)" },
  pago: { label: "Pago", bg: "var(--color-client-ativo-bg)", fg: "var(--color-crm-green)" },
  atrasado: { label: "Atrasado", bg: "var(--color-client-risco-bg)", fg: "var(--color-client-risco-fg)" },
} as const;

export type InvoiceBadge = keyof typeof INVOICE_BADGES;

export const CONTRACT_CYCLES: { id: ContractCycle; label: string }[] = [
  { id: "mensal", label: "Mensal" },
  { id: "trimestral", label: "Trimestral" },
  { id: "semestral", label: "Semestral" },
  { id: "anual", label: "Anual" },
];

export function isContractCycle(v: unknown): v is ContractCycle {
  return CONTRACT_CYCLES.some((c) => c.id === v);
}

/** As quatro pastas do export, na ordem. */
export const FILE_FOLDERS: { id: FileFolder; label: string }[] = [
  { id: "contratos", label: "Contratos" },
  { id: "briefings", label: "Briefings" },
  { id: "criativos", label: "Criativos" },
  { id: "relatorios", label: "Relatórios" },
];

export function isFileFolder(v: unknown): v is FileFolder {
  return FILE_FOLDERS.some((f) => f.id === v);
}

export const EVENT_KINDS: { id: EventKind; label: string }[] = [
  { id: "reuniao", label: "Reunião" },
  { id: "gravacao", label: "Gravação" },
  { id: "entrega", label: "Entrega" },
  { id: "outro", label: "Outro" },
];

export function isEventKind(v: unknown): v is EventKind {
  return EVENT_KINDS.some((k) => k.id === v);
}

/** Os filtros da aba Atividades, na ordem do export. */
export const ACTIVITY_FILTERS: { id: ActivityKind | "tudo"; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "aprovacao", label: "Aprovações" },
  { id: "comentario", label: "Comentários" },
  { id: "arquivo", label: "Arquivos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "reuniao", label: "Reuniões" },
];

/** O ladrilho do ícone de cada atividade (fundo e traço), do export. */
export const ACTIVITY_TONES: Record<ActivityKind, { bg: string; fg: string }> = {
  aprovacao: { bg: "var(--color-client-ativo-bg)", fg: "var(--color-crm-green)" },
  comentario: { bg: "var(--color-crm-blue-bg)", fg: "var(--color-crm-blue)" },
  arquivo: { bg: "var(--color-crm-purple-bg)", fg: "var(--color-crm-purple)" },
  financeiro: { bg: "var(--color-client-renovacao-bg)", fg: "var(--color-crm-amber)" },
  reuniao: { bg: "var(--color-crm-blue-bg)", fg: "var(--color-crm-blue)" },
};

/** O cartão do arquivo: a cor do topo e do ícone pelo tipo (export, "Arquivos recentes"). */
export type FileTone = "pdf" | "imagem" | "video" | "planilha" | "codigo" | "outro";

export const FILE_TONES: Record<FileTone, { bg: string; fg: string }> = {
  pdf: { bg: "var(--color-crm-red-bg)", fg: "var(--color-crm-red)" },
  imagem: { bg: "var(--color-crm-blue-bg)", fg: "var(--color-crm-blue)" },
  video: { bg: "var(--color-crm-purple-bg)", fg: "var(--color-crm-purple)" },
  planilha: { bg: "var(--color-crm-sheet-bg)", fg: "var(--color-crm-sheet)" },
  codigo: { bg: "var(--color-crm-blue-bg)", fg: "var(--color-crm-blue)" },
  outro: { bg: "var(--color-badge-neutral)", fg: "var(--color-fg-3)" },
};

/** Tetos do que a ficha guarda. */
export const CRM_LIMITS = {
  services: 30,
  invoices: 240,
  files: 500,
  events: 200,
  /** R$ 1 milhão por mês, em centavos — acima disso é erro de digitação. */
  maxCents: 100_000_000,
} as const;

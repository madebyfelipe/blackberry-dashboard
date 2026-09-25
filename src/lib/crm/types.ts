import type { AgencyId } from "@/lib/agency/types";

/*
 * A ficha do cliente (export "Clientes · Detalhe": Visão geral, Serviços,
 * Financeiro, Arquivos e Atividades) — o "CRM pós-venda" do README.
 *
 * O cadastro do cliente continua sendo `lib/clients` (nome, segmento,
 * contato, squad, status). O que só a ficha usa mora aqui, numa conta por
 * cliente: o que ele contratou, o que pagou, o contrato, os arquivos e a
 * agenda. Valores em dinheiro são sempre **centavos inteiros** — nada de
 * float para dinheiro.
 */

/** O ícone da linha do serviço (Instagram, documento, megafone, câmera…). */
export type ServiceKind =
  | "instagram"
  | "blog"
  | "trafego"
  | "producao"
  | "email"
  | "site"
  | "design"
  | "outro";

/** "Ativo" · "Em setup" · "Pausado" — a coluna STATUS da aba Serviços. */
export type ServiceStatus = "ativo" | "setup" | "pausado";

export type ClientService = {
  id: string;
  /** "Gestão de Instagram" */
  name: string;
  kind: ServiceKind;
  /** "12 posts + stories" — a coluna ESCOPO. */
  scope: string;
  /** Membro do time (`InboxMember.id`) que responde pelo serviço. */
  responsibleId: string | null;
  /** Valor mensal em centavos. */
  monthlyValue: number;
  status: ServiceStatus;
  /**
   * Meta de entregas do mês ("12" posts). `null` = serviço que não se conta
   * em entregas (tráfego pago, produção) — o progresso é a `stage`.
   */
  quota: number | null;
  /** "posts", "artigos" — a unidade da meta. */
  unit: string;
  /** Entregas feitas em `deliveredMonth`. */
  delivered: number;
  /** "2026-09" — de que mês é o `delivered`; outro mês conta zero. */
  deliveredMonth: string;
  /** Situação do serviço sem meta ("Em veiculação", "Agendada"). */
  stage: string;
  createdAt: string;
};

export type PaymentKind = "pix" | "cartao" | "boleto" | "transferencia";

/** A forma de pagamento da ficha. Do cartão, só bandeira, final e validade. */
export type PaymentMethod = {
  kind: PaymentKind;
  /** "Visa" — só cartão. */
  brand: string;
  /** "4821" — os 4 últimos dígitos, nunca o número inteiro. */
  last4: string;
  /** "08/26" */
  expires: string;
};

/**
 * `aberto` vira "A vencer" ou "Atrasado" pela data de vencimento — a régua
 * está em `view.ts`, não gravada, para não ficar velha.
 */
export type InvoiceStatus = "aberto" | "pago";

export type Invoice = {
  id: string;
  /** "2026-10" — o mês de referência (COMPETÊNCIA). */
  competence: string;
  /** "2026-10-05" — data, sem hora. */
  dueDate: string;
  /** Centavos. */
  amount: number;
  method: PaymentKind;
  status: InvoiceStatus;
  /** ISO — quando foi marcada paga. */
  paidAt: string | null;
  createdAt: string;
};

export type ContractCycle = "mensal" | "trimestral" | "semestral" | "anual";

export type Contract = {
  /** "2025-01-01" — início do contrato. `null` = ainda não definido. */
  startDate: string | null;
  /** Fidelidade em meses ("12 meses"). `null` = sem fidelidade. */
  fidelityMonths: number | null;
  cycle: ContractCycle;
  /** Índice do reajuste anual ("IPCA", "IGP-M"). Vazio = sem reajuste. */
  adjustmentIndex: string;
};

/** As quatro pastas do export (Arquivos › PASTAS). */
export type FileFolder = "contratos" | "briefings" | "criativos" | "relatorios";

export type ClientFile = {
  id: string;
  /** O arquivo em `lib/media` — bytes servidos por `/api/media/<id>`. */
  mediaId: string;
  name: string;
  mime: string;
  size: number;
  folder: FileFolder;
  /** Nome de quem enviou, da sessão. */
  uploadedBy: string;
  createdAt: string;
};

export type EventKind = "reuniao" | "gravacao" | "entrega" | "outro";

/** Um compromisso com o cliente (Próximos eventos; vira atividade quando passa). */
export type ClientEvent = {
  id: string;
  kind: EventKind;
  title: string;
  /** ISO, com hora. */
  at: string;
  /** "Estúdio", "Online". */
  place: string;
  createdBy: string;
  createdAt: string;
};

/** A conta do cliente — um registro por cliente, criado na primeira gravação. */
export type ClientAccount = {
  clientId: string;
  agencyId: AgencyId;
  contract: Contract;
  payment: PaymentMethod | null;
  services: ClientService[];
  invoices: Invoice[];
  files: ClientFile[];
  events: ClientEvent[];
};

/** O que a aba Atividades lista — montado na leitura, nunca gravado. */
export type ActivityKind = "aprovacao" | "comentario" | "arquivo" | "financeiro" | "reuniao";

export type Activity = {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  who: string;
  /** ISO */
  at: string;
};

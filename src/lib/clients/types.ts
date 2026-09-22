import type { AgencyId } from "@/lib/agency/types";

/**
 * Saúde do cliente na carteira. É a única régua do produto em que a cor
 * carrega significado — os pares fundo/texto de cada degrau moram em
 * `constants.ts`, e os valores, em `globals.css`.
 */
export type ClientStatus =
  | "ativo"
  | "renovacao"
  | "risco"
  | "pausado"
  | "novo"
  | "vip";

/**
 * O cliente da agência, agora como entidade.
 *
 * Até aqui "cliente" era texto livre dentro da tarefa e do lote
 * (`lib/approval/clients.ts` ainda agrupa lotes pelo slug do nome). Esta é a
 * ficha de verdade, com o que a tela de Clientes mostra — nada além disso: o
 * briefing tem tela própria, ainda por desenhar, e não inventa campo aqui.
 */
export type Client = {
  id: string;
  /**
   * Agência dona do cliente. Vem sempre do escopo da sessão, nunca da
   * requisição — ver `repository.ts`.
   */
  agencyId: AgencyId;
  name: string;
  /** Ramo do cliente ("Estética facial", "Odontologia"). */
  segment: string;
  /** O que a agência entrega para ele ("Instagram", "Google Ads"). */
  services: string[];
  /**
   * Contato da ficha, o que o cartão de hover do nome mostra (export
   * "hover clientes"): cidade, e-mail e telefone. Vazio é vazio — o cartão
   * mostra traço, não um dado inventado.
   */
  city: string;
  email: string;
  phone: string;
  /** Quem cuida da conta dentro da agência — nome curto, como o responsável da tarefa. */
  owner: string;
  /** Dia do mês do faturamento (1–31). `null` = ainda não definido. */
  billingDay: number | null;
  status: ClientStatus;
  /** ISO date */
  createdAt: string;
};

export type NewClient = {
  name: string;
  segment?: string;
  services?: string[];
  city?: string;
  email?: string;
  phone?: string;
  owner?: string;
  billingDay?: number | null;
  status?: ClientStatus;
};

/** A agência fica de fora: cliente não muda de dono por um PATCH. */
export type ClientPatch = Partial<
  Omit<Client, "id" | "createdAt" | "agencyId">
>;

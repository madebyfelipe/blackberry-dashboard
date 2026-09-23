import type { AgencyId } from "@/lib/agency/types";

/** Papéis do produto (spec: Coordenação, Social media, Designer). */
export type Role = "coordenacao" | "social" | "designer";

export type User = {
  id: string;
  name: string;
  /** Normalizado em minúsculas — é a chave de login. */
  email: string;
  role: Role;
  /** Nome da agência, como a pessoa escreve. Muda; não serve de chave. */
  agency: string;
  /**
   * Tenant do usuário: é ele que todo `repository` usa para filtrar. Nasce do
   * nome no cadastro (ver `lib/agency/id.ts`) e não muda mais — renomear a
   * agência não pode trocar de tenant.
   */
  agencyId: AgencyId;
  /** Formato "scrypt$<salt hex>$<hash hex>" (ver `password.ts`). */
  passwordHash: string;
  /**
   * Sobe a cada troca de senha. O token de sessão carrega a versão que valia
   * quando foi emitido, então trocar a senha derruba as sessões antigas sem
   * precisar de uma lista de sessões abertas (ver `token.ts` e `session.ts`).
   */
  passwordVersion: number;
  createdAt: string;
};

/** O que pode sair do servidor: tudo menos o hash da senha. */
export type PublicUser = Omit<User, "passwordHash">;

export type Credentials = { email: string; password: string };

export type NewUser = Credentials & {
  name: string;
  role?: Role;
  agency?: string;
  /**
   * Cadastro por convite: a conta nasce **dentro** da agência que convidou,
   * em vez de abrir um tenant novo. Quem resolve o convite (e confere o
   * e-mail) é a rota de cadastro, a partir do token — nunca o corpo.
   */
  joinAgency?: { agencyId: import("@/lib/agency/types").AgencyId; agencyName: string };
};

/** Papéis do produto (spec: Coordenação, Social media, Designer). */
export type Role = "coordenacao" | "social" | "designer";

export type User = {
  id: string;
  name: string;
  /** Normalizado em minúsculas — é a chave de login. */
  email: string;
  role: Role;
  /** Agência a que o usuário pertence — raiz do multi-tenant que vem depois. */
  agency: string;
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
};

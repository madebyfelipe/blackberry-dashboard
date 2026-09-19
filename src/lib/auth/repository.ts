import { read, transaction } from "./store";
import { hashPassword, verifyPassword } from "./password";
import type { Credentials, NewUser, PublicUser, Role, User } from "./types";

/** Toda leitura/escrita de usuário passa por aqui. */

export class AuthError extends Error {}

const ROLES: Role[] = ["coordenacao", "social", "designer"];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _hash, ...rest } = user;
  return rest;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUserById(id: string): Promise<PublicUser | undefined> {
  const user = (await read()).find((u) => u.id === id);
  return user && toPublic(user);
}

/**
 * Versão atual da senha do usuário — vai dentro do token quando a sessão
 * começa. Sobe a cada troca de senha (ver `changePassword`).
 */
export async function getPasswordVersion(id: string): Promise<number> {
  return (await read()).find((u) => u.id === id)?.passwordVersion ?? 1;
}

/**
 * Usuário de uma sessão em curso. Só devolve se a versão da senha gravada for
 * a mesma que o token carrega: depois de uma troca de senha, os tokens
 * emitidos antes deixam de valer, em qualquer aparelho.
 */
export async function getUserForSession(
  id: string,
  passwordVersion: number,
): Promise<PublicUser | undefined> {
  const user = (await read()).find((u) => u.id === id);
  if (!user || user.passwordVersion !== passwordVersion) return undefined;
  return toPublic(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  return (await read()).map(toPublic);
}

export async function registerUser(input: NewUser): Promise<PublicUser> {
  const name = input.name?.trim();
  const email = normalizeEmail(input.email ?? "");
  const password = input.password ?? "";

  if (!name) throw new AuthError("Informe seu nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError("E-mail inválido.");
  }
  if (password.length < 8) {
    throw new AuthError("A senha precisa de pelo menos 8 caracteres.");
  }

  // Hash fora da transação: scrypt é caro e não deve segurar a fila.
  const passwordHash = await hashPassword(password);

  return transaction((users) => {
    if (users.some((u) => u.email === email)) {
      throw new AuthError("Já existe uma conta com esse e-mail.");
    }
    const user: User = {
      id: "u" + Math.random().toString(36).slice(2, 9),
      name,
      email,
      role: isRole(input.role) ? input.role : "coordenacao",
      agency: (input.agency ?? "").trim() || `Agência de ${name.split(" ")[0]}`,
      passwordHash,
      passwordVersion: 1,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return toPublic(user);
  });
}

/**
 * Login. A mensagem de erro é a mesma para e-mail inexistente e senha errada —
 * não entrega quais e-mails existem na base.
 */
export async function authenticate(
  credentials: Credentials,
): Promise<PublicUser> {
  const email = normalizeEmail(credentials.email ?? "");
  const password = credentials.password ?? "";
  const user = (await read()).find((u) => u.email === email);
  const failure = new AuthError("E-mail ou senha incorretos.");
  if (!user) throw failure;
  if (!(await verifyPassword(password, user.passwordHash))) throw failure;
  return toPublic(user);
}

/** Nome e agência (tela de configurações). E-mail e papel não mudam aqui. */
export async function updateProfile(
  userId: string,
  patch: { name?: string; agency?: string },
): Promise<PublicUser> {
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) {
    throw new AuthError("O nome não pode ficar vazio.");
  }
  return transaction((users) => {
    const user = users.find((u) => u.id === userId);
    if (!user) throw new AuthError("Usuário não encontrado.");
    if (name) user.name = name;
    if (patch.agency !== undefined) {
      const agency = patch.agency.trim();
      if (!agency) throw new AuthError("O nome da agência não pode ficar vazio.");
      user.agency = agency;
    }
    return toPublic(user);
  });
}

/**
 * Troca de senha a partir da senha atual (tela de configurações).
 *
 * Devolve a nova versão da senha: quem chama reemite o cookie com ela, para o
 * aparelho que acabou de trocar continuar logado enquanto todos os outros
 * caem.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<number> {
  if (nextPassword.length < 8) {
    throw new AuthError("A nova senha precisa de pelo menos 8 caracteres.");
  }
  const user = (await read()).find((u) => u.id === userId);
  if (!user) throw new AuthError("Usuário não encontrado.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AuthError("Senha atual incorreta.");
  }
  const passwordHash = await hashPassword(nextPassword);
  return transaction((users) => {
    const u = users.find((x) => x.id === userId);
    if (!u) throw new AuthError("Usuário não encontrado.");
    u.passwordHash = passwordHash;
    // Derruba as sessões abertas antes desta troca.
    u.passwordVersion += 1;
    return u.passwordVersion;
  });
}

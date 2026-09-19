import {
  randomBytes,
  scrypt as scryptCb,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/*
 * Hash de senha com scrypt (node:crypto) — sem dependência externa.
 *
 * Formato gravado: "scrypt$<salt hex>$<hash hex>". O salt é por usuário e o
 * parâmetro N fica no formato implícito (padrão do Node: 16384). Ao trocar o
 * custo no futuro, versionar o prefixo ("scrypt2$…") e reescrever no login.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Versão síncrona — usada só para semear o usuário de demonstração. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  // Comprimentos diferentes fariam timingSafeEqual lançar.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

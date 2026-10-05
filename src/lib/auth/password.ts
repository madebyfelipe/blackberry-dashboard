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
 * Formato novo (issue #110): "scrypt2$<N>$<r>$<p>$<salt hex>$<hash hex>",
 * com os três parâmetros de custo gravados no registro (não implícitos), e
 * N/r/p no mínimo que o OWASP recomenda para esta memória (~16 MB):
 * `SCRYPT_P = 5` — o padrão do Node (p=1) deixava a senha ~5x mais barata de
 * quebrar se a área de contas vazasse. O salt continua por usuário.
 *
 * Formato antigo ("scrypt$<salt>$<hash>", N/r/p implícitos no padrão do
 * Node) continua **verificando** — senha antiga não para de entrar — mas
 * `needsRehash` marca o registro para regravar no formato novo, e quem
 * chama (`authenticate`, em `repository.ts`) regrava com a senha que acabou
 * de conferir. Não é migração de uma vez: reescreve sozinho, uma conta por
 * vez, a cada login que acertar.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const KEY_LEN = 64;

/** 2^14 — mesma memória do padrão do Node (128 × N × r ≈ 16 MB). */
export const SCRYPT_N = 16384;
export const SCRYPT_R = 8;
/** O mínimo do OWASP para N=2^14/r=8; o padrão do Node era p=1. */
export const SCRYPT_P = 5;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Versão síncrona — usada só para semear o usuário de demonstração. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Hash fixo, nunca a senha de ninguém — só para gastar o mesmo tempo de um
 * scrypt de verdade quando o e-mail não existe (ver `authenticate`, em
 * `repository.ts`). Sem isso, "e-mail inexistente" respondia bem mais rápido
 * que "senha errada" (que roda o scrypt), e o tempo de resposta já dizia
 * quais e-mails têm conta — issue #110, item 2.
 */
const DECOY_HASH =
  "scrypt2$16384$8$5$00000000000000000000000000000000$5896d94842df27dd9665a7d6c31c5bb5b403498ff84a24a5f3e59b16bb80f47b98c364fe4560efbe5d5d4797f6436a575597be3e90c8ba5b45e488dfa5d6c19e";

/** Confere uma senha contra o hash-chamariz — mesmo custo, sempre falso. */
export async function verifyDecoyPassword(password: string): Promise<void> {
  await verifyPassword(password, DECOY_HASH);
}

/** Se este hash não está no formato/custo atual — `authenticate` regrava. */
export function needsRehash(stored: string): boolean {
  const [scheme, nStr, rStr, pStr] = stored.split("$");
  if (scheme !== "scrypt2") return true;
  return Number(nStr) !== SCRYPT_N || Number(rStr) !== SCRYPT_R || Number(pStr) !== SCRYPT_P;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  const scheme = parts[0];

  // Formato antigo: N/r/p implícitos (padrão de sempre do Node: N=16384,
  // r=8, p=1) — mantido só para a senha gravada antes desta mudança entrar.
  const [N, r, p, saltHex, hashHex] =
    scheme === "scrypt2"
      ? [Number(parts[1]), Number(parts[2]), Number(parts[3]), parts[4], parts[5]]
      : scheme === "scrypt"
        ? [16384, 8, 1, parts[1], parts[2]]
        : [];

  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N! <= 0 ||
    r! <= 0 ||
    p! <= 0 ||
    !saltHex ||
    !hashHex
  ) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const salt = Buffer.from(saltHex, "hex");
  /*
   * Hash ou salt ilegíveis (registro corrompido ou adulterado à mão, ex.
   * "scrypt$aa$zz"): `Buffer.from(..., "hex")` devolve vazio em vez de falhar,
   * e aí o scrypt geraria 0 bytes — `timingSafeEqual` compararia nada com nada
   * e aprovaria QUALQUER senha. Recusar é o único caminho seguro.
   */
  if (expected.length === 0 || salt.length === 0) return false;
  const actual = await scrypt(password, salt, expected.length, { N: N!, r: r!, p: p! });
  // Comprimentos diferentes fariam timingSafeEqual lançar.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

import { LEGACY_AGENCY_ID, LEGACY_AGENCY_NAME } from "@/lib/agency/id";
import { hashPasswordSync } from "./password";
import type { User } from "./types";

/** Senha de desenvolvimento da conta semeada — pública, está no README. */
export const DEV_DEMO_PASSWORD = "blackberry";

/** Tamanho mínimo de `DEMO_PASSWORD` em produção. */
export const DEMO_PASSWORD_MIN = 12;

/**
 * O que se diz a quem subiu produção com o banco vazio e sem `DEMO_PASSWORD`.
 * Mesmo espírito de `AUTH_SECRET_AUSENTE` (token.ts): o passo a passo no log,
 * não só o nome da variável.
 */
export const DEMO_PASSWORD_AUSENTE = [
  `DEMO_PASSWORD não está definida (ou tem menos de ${DEMO_PASSWORD_MIN} caracteres).`,
  "O banco ainda não tem contas e o app ia semear felipe@blackberry.app (Admin)",
  `com a senha de desenvolvimento "${DEV_DEMO_PASSWORD}", que está no README —`,
  "qualquer um que o leia entraria. Por isso produção recusa semear sem ela.",
  "",
  "Gere uma senha:    openssl rand -base64 18",
  "E defina:          Vercel → Settings → Environment Variables → DEMO_PASSWORD",
].join("\n");

/**
 * A senha da conta semeada. Fora de produção vale `DEMO_PASSWORD` ou o padrão
 * de desenvolvimento; em produção só `DEMO_PASSWORD`, com tamanho mínimo — sem
 * ela, lança em vez de cair na senha pública.
 *
 * Só roda quando a área de contas ainda não existe (primeiro boot de um banco
 * novo): uma instância já semeada não passa por aqui, então a variável não é
 * exigida de quem já tem contas.
 */
export function demoPassword(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.DEMO_PASSWORD;
  if (env.NODE_ENV !== "production") return fromEnv || DEV_DEMO_PASSWORD;
  if (!fromEnv || fromEnv.length < DEMO_PASSWORD_MIN) {
    throw new Error(DEMO_PASSWORD_AUSENTE);
  }
  return fromEnv;
}

/**
 * Conta de demonstração — o app precisa abrir logo depois de um `npm run dev`,
 * sem cadastro manual. Credenciais documentadas no README.
 *
 * A senha sai de `demoPassword`: em produção, obrigatoriamente de
 * `DEMO_PASSWORD`.
 */
export function seedUsers(): User[] {
  const password = demoPassword();
  const now = new Date().toISOString();
  return [
    {
      id: "u1",
      name: "Felipe",
      email: "felipe@blackberry.app",
      role: "coordenacao",
      // A agência semeada é a dona dos dados de demonstração e o destino da
      // migração de tudo que foi gravado antes do multi-tenant.
      agency: LEGACY_AGENCY_NAME,
      agencyId: LEGACY_AGENCY_ID,
      passwordHash: hashPasswordSync(password),
      passwordVersion: 1,
      createdAt: now,
    },
  ];
}

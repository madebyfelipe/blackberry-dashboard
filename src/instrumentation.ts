import { AUTH_SECRET_AUSENTE, isProductionSecretMissing } from "@/lib/auth/token";

/*
 * Roda uma vez por instância de servidor, antes da primeira requisição
 * (convenção `instrumentation.ts` do Next — a mesma pasta do `app`, por causa
 * do `src/`).
 *
 * É aqui que fica a recusa de subir produção sem AUTH_SECRET, e não no build:
 * `registerInstrumentation` é explicitamente pulado na fase de build (ver
 * `next/dist/server/lib/router-utils/instrumentation-globals.external.js`),
 * então este arquivo não derruba o `npm run build` do CI — que roda em
 * NODE_ENV=production e, de propósito, sem segredo nenhum. O build continua
 * verde; quem não sobe é o servidor, que é onde a falta do segredo faria
 * estrago.
 *
 * Um hook que lança é, para o Next, servidor que não preparou: ele loga
 * "Failed to prepare server" e responde 500 em toda requisição. Ninguém entra
 * com sessão forjada porque ninguém entra.
 *
 * A segunda barreira vive em `lib/auth/token.ts`, no caminho de assinar e
 * conferir o cookie: ela cobre o runtime do proxy (Edge), que não passa por
 * aqui, e qualquer hospedagem que ignore o hook.
 */
export function register(): void {
  if (!isProductionSecretMissing()) return;
  // O throw sobe embrulhado pelo Next ("An error occurred while loading
  // instrumentation hook: …"); o log solto garante o texto inteiro, com o
  // passo a passo, no topo da saída.
  console.error(`\n${AUTH_SECRET_AUSENTE}\n`);
  throw new Error(AUTH_SECRET_AUSENTE);
}

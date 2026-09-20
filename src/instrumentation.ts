import { assertAuthSecret } from "@/lib/auth/token";

/*
 * `register()` roda uma vez, antes de o servidor aceitar o primeiro request
 * (ver node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions
 * /instrumentation.md). É a segunda trava do AUTH_SECRET: o `next.config.ts`
 * pega o build e o `next start`, e esta pega a subida do servidor onde o
 * config não é reavaliado — o caso das funções da Vercel.
 */
export function register(): void {
  assertAuthSecret();
}

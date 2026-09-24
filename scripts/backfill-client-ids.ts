/*
 * Roda o backfill de `clientId` (ver `src/lib/maintenance/backfill-client-ids.ts`).
 *
 * `npm run backfill:client-ids` — sem `DATABASE_URL`, mexe no `data/*.json`
 * local; com a variável definida (produção), mexe nas linhas do Postgres.
 * Idempotente: rodar de novo não muda quem já tem `clientId`.
 */
import { backfillClientIds } from "../src/lib/maintenance/backfill-client-ids";

const { tasksUpdated, batchesUpdated } = await backfillClientIds();
console.log(`Tarefas vinculadas: ${tasksUpdated}`);
console.log(`Lotes vinculados: ${batchesUpdated}`);
// O pool do Postgres (quando há DATABASE_URL) mantém conexão aberta; sem isto
// o processo de um script de linha de comando nunca termina sozinho.
process.exit(0);

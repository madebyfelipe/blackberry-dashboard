import { foldName } from "@/lib/clients/repository";
import { read as readClients } from "@/lib/clients/store";
import { transaction as transactionTasks } from "@/lib/tasks/store";
import { transaction as transactionBatches } from "@/lib/approval/store";

/*
 * Liga `Task.clientId`/`Batch.clientId` em registros gravados antes desse
 * vínculo existir (ver ROADMAP, "Dívidas conhecidas").
 *
 * Não é migração de leitura (como `agencyIdOrLegacy` em cada `store.ts`)
 * porque essa é síncrona e não pode consultar a lista de clientes — por isso
 * o ROADMAP registra que não há backfill retroativo automático. Isto aqui é
 * o backfill manual que fecha essa lacuna: roda uma vez (`npm run
 * backfill:client-ids`), usa a mesma régua de nome de `resolveClientId`
 * (sem acento, sem caixa, escopada por agência) e só toca o que ainda não
 * tem par.
 */
export type BackfillResult = { tasksUpdated: number; batchesUpdated: number };

export async function backfillClientIds(): Promise<BackfillResult> {
  const clientIdByAgencyAndName = new Map<string, Map<string, string>>();
  for (const client of await readClients()) {
    let byName = clientIdByAgencyAndName.get(client.agencyId);
    if (!byName) clientIdByAgencyAndName.set(client.agencyId, (byName = new Map()));
    byName.set(foldName(client.name), client.id);
  }

  function resolve(agencyId: string, name: string): string | null {
    return clientIdByAgencyAndName.get(agencyId)?.get(foldName(name)) ?? null;
  }

  let tasksUpdated = 0;
  await transactionTasks((tasks) => {
    for (const task of tasks) {
      if (task.clientId || !task.client) continue;
      const clientId = resolve(task.agencyId, task.client);
      if (clientId) {
        task.clientId = clientId;
        tasksUpdated++;
      }
    }
  });

  let batchesUpdated = 0;
  await transactionBatches((batches) => {
    for (const batch of batches) {
      if (batch.clientId || !batch.client) continue;
      const clientId = resolve(batch.agencyId, batch.client);
      if (clientId) {
        batch.clientId = clientId;
        batchesUpdated++;
      }
    }
  });

  return { tasksUpdated, batchesUpdated };
}

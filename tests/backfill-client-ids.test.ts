import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste.
usarDataDirTemporario("backfill-client-ids");

// Tarefas e lotes "antigos" — gravados como se fosse antes do vínculo com
// `Client.id` existir: `client` como texto livre, `clientId` já nulo.
escreverData("tasks.json", [
  { id: "t1", agencyId: AGENCIA_A.agencyId, client: "Clínica Aurora", clientId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t2", agencyId: AGENCIA_A.agencyId, client: "Ninguém cadastrado", clientId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t3", agencyId: AGENCIA_A.agencyId, client: "", clientId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t4", agencyId: AGENCIA_B.agencyId, client: "Clínica Aurora", clientId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "t5", agencyId: AGENCIA_A.agencyId, client: "Clínica Aurora", clientId: "ja-vinculado", createdAt: "2026-01-01T00:00:00.000Z" },
]);
escreverData("batches.json", [
  {
    id: "b1",
    agencyId: AGENCIA_A.agencyId,
    client: "clinica aurora",
    clientId: null,
    label: "Lote antigo",
    token: "tok-b1",
    pieces: [],
  },
]);
escreverData("clients.json", []);

const { createClient } = await import("../src/lib/clients/repository");
const { backfillClientIds } = await import("../src/lib/maintenance/backfill-client-ids");
const { read: readTasks } = await import("../src/lib/tasks/store");
const { read: readBatches } = await import("../src/lib/approval/store");

describe("backfillClientIds", () => {
  test("liga tarefa e lote antigos ao cliente cadastrado, sem mexer no resto", async () => {
    const cliente = await createClient(AGENCIA_A, { name: "Clínica Aurora" });

    const primeira = await backfillClientIds();
    assert.equal(primeira.tasksUpdated, 1, "só t1 tinha ficha correspondente na Agência A");
    assert.equal(primeira.batchesUpdated, 1);

    const tarefas = await readTasks();
    const t1 = tarefas.find((t) => t.id === "t1");
    const t2 = tarefas.find((t) => t.id === "t2");
    const t3 = tarefas.find((t) => t.id === "t3");
    const t4 = tarefas.find((t) => t.id === "t4");
    const t5 = tarefas.find((t) => t.id === "t5");

    assert.equal(t1?.clientId, cliente.id);
    assert.equal(t2?.clientId, null, "sem ficha correspondente, continua null");
    assert.equal(t3?.clientId, null, "cliente vazio não busca nada");
    assert.equal(t4?.clientId, null, "ficha é da Agência A — não vaza para a B");
    assert.equal(t5?.clientId, "ja-vinculado", "quem já tinha clientId não é sobrescrito");

    const lotes = await readBatches();
    assert.equal(lotes.find((b) => b.id === "b1")?.clientId, cliente.id);
  });

  test("rodar de novo não muda nada — idempotente", async () => {
    const segunda = await backfillClientIds();
    assert.equal(segunda.tasksUpdated, 0);
    assert.equal(segunda.batchesUpdated, 0);
  });
});

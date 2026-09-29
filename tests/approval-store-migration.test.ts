import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

/*
 * Migração de leitura de `sentAt` (issue #106): banco gravado antes desta
 * correção não tinha como o link público separar peça enviada de rascunho.
 * `backfillSentAt` (em `lib/approval/store.ts`) precisa manter no ar quem já
 * estava visível — e só quem já estava — sem depender do app ter rodado
 * `sendBatchForApproval` de novo.
 */
usarDataDirTemporario("approval-store-migration");

escreverData("batches.json", [
  {
    // Sem `stage`: gravado antes do conceito de rascunho existir — sempre
    // esteve no ar, então toda peça herda o envio.
    id: "lote-legado",
    agencyId: AGENCIA_A.agencyId,
    client: "Cliente legado",
    label: "Lote agosto",
    token: "tokenLoteLegado",
    pieces: [
      {
        id: "pl1",
        name: "Peça 01",
        size: "1080 x 1080",
        date: "2026-08-10T08:00:00.000Z",
        status: "pendente",
        kind: "Feed",
        history: [],
      },
    ],
  },
  {
    // Com `stage`: já vivia no mundo com rascunho/envio separados. Uma peça
    // tem o histórico de envio (foi mostrada de verdade); a outra foi
    // adicionada depois e nunca foi reenviada.
    id: "lote-misto",
    agencyId: AGENCIA_A.agencyId,
    client: "Cliente misto",
    label: "Lote setembro",
    stage: "em-aprovacao",
    token: "tokenLoteMisto",
    pieces: [
      {
        id: "pm1",
        name: "Peça 01",
        size: "1080 x 1080",
        date: "2026-09-01T08:00:00.000Z",
        status: "pendente",
        kind: "Feed",
        history: [{ id: "h1", at: "2026-09-01T09:00:00.000Z", title: "Enviada para aprovação", who: "Agência" }],
      },
      {
        id: "pm2",
        name: "Peça 02 — rascunho novo",
        size: "1080 x 1080",
        date: "2026-09-20T08:00:00.000Z",
        status: "pendente",
        kind: "Feed",
        history: [{ id: "h2", at: "2026-09-20T08:00:00.000Z", title: "Peça criada no lote", who: "Agência" }],
      },
    ],
  },
]);
escreverData("clients.json", []);

const { decidePiece, getBatchByToken } = await import("../src/lib/approval/repository");
const { toPublicBatch } = await import("../src/lib/approval/public");

describe("backfill de sentAt em leitura de dado antigo", () => {
  test("lote sem `stage`: todas as peças já estavam no ar", async () => {
    const batch = await getBatchByToken("tokenLoteLegado");
    assert.equal(toPublicBatch(batch!).pieces.length, 1);
    const decidida = await decidePiece("tokenLoteLegado", "pl1", "aprovado");
    assert.ok(decidida && decidida !== "inactive-link");
  });

  test("lote com `stage`: só quem já tem o histórico de envio continua visível", async () => {
    const batch = await getBatchByToken("tokenLoteMisto");
    const ids = toPublicBatch(batch!).pieces.map((p) => p.id);
    assert.deepEqual(ids, ["pm1"], "pm2 nunca passou pelo envio");
    assert.equal(await decidePiece("tokenLoteMisto", "pm2", "aprovado"), undefined);
  });
});

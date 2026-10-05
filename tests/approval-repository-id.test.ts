import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("approval-batch-id");
escreverData("batches.json", []);

const { createBatch } = await import("../src/lib/approval/repository");

/*
 * Issue #111: o id do lote nascia com sufixo `-2` só quando **qualquer**
 * agência já tinha um lote com o mesmo nome — um oráculo que revelava "esse
 * cliente/título já existe em outra conta". Toda leitura de lote filtra por
 * (id, agencyId), então o choque só importa dentro da própria agência.
 */
describe("createBatch — id sem oráculo entre agências", () => {
  test("mesmo nome em outra agência não empurra sufixo", async () => {
    const primeiro = await createBatch(AGENCIA_A, { client: "Clínica Aurora", title: "Lote outubro" });
    const segundo = await createBatch(AGENCIA_B, { client: "Clínica Aurora", title: "Lote outubro" });
    assert.equal(primeiro?.id, segundo?.id, "o id não deveria mudar por causa da outra agência");
  });

  test("mesmo nome na mesma agência ainda ganha sufixo (dois lotes de verdade)", async () => {
    const primeiro = await createBatch(AGENCIA_A, { client: "Posto Sul", title: "Lote setembro" });
    const segundo = await createBatch(AGENCIA_A, { client: "Posto Sul", title: "Lote setembro" });
    assert.notEqual(primeiro?.id, segundo?.id);
    assert.equal(segundo?.id, `${primeiro?.id}-2`);
  });
});

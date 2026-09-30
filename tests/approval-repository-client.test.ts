import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("approval-client");
escreverData("batches.json", []);
// Vazio, não ausente: um `clients.json` ausente faria o store dos clientes
// semear a demonstração, e este arquivo quer controlar exatamente quem existe.
escreverData("clients.json", []);

const { createBatch } = await import("../src/lib/approval/repository");
const { createClient } = await import("../src/lib/clients/repository");

/*
 * `createBatch` é a outra ponta do mesmo vínculo testado em
 * `tasks-repository.test.ts` — o texto livre do cliente resolvido contra a
 * ficha cadastrada (`resolveClientId`), na criação do lote.
 */
describe("createBatch — clientId", () => {
  test("texto do cliente batendo com uma ficha resolve o id", async () => {
    const cliente = await createClient(AGENCIA_A, { name: "Clínica Aurora" });
    const lote = await createBatch(AGENCIA_A, {
      client: "  clinica aurora  ",
      title: "Lote outubro",
    });
    assert.equal(lote?.clientId, cliente.id);
  });

  test("sem ficha correspondente, o lote nasce sem vínculo", async () => {
    const lote = await createBatch(AGENCIA_A, {
      client: "Cliente sem cadastro",
      title: "Lote outubro",
    });
    assert.equal(lote?.clientId, null);
  });

  test("ficha de outra agência não vincula — mesmo nome, tenant diferente", async () => {
    await createClient(AGENCIA_B, { name: "Cliente Compartilhado" });
    const lote = await createBatch(AGENCIA_A, {
      client: "Cliente Compartilhado",
      title: "Lote outubro",
    });
    assert.equal(lote?.clientId, null);
  });
});

// Issue #107: cliente, título, período e descrição do lote não tinham teto —
// e cliente/título formam o id do lote (`slugify`), então um campo gigante
// também inchava o id gravado.
describe("createBatch — teto do texto livre", () => {
  test("cliente, título, período e descrição são cortados no teto", async () => {
    const lote = await createBatch(AGENCIA_A, {
      client: "x".repeat(200),
      title: "y".repeat(200),
      period: "z".repeat(200),
      description: "w".repeat(3000),
    });
    assert.equal(lote?.client.length, 80);
    assert.ok(lote!.label.length <= 120 + 3 + 40, "rótulo = título · período, ambos já cortados");
    assert.equal(lote?.description?.length, 2000);
  });
});

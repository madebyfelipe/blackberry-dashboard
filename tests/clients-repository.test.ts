import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("clients");
escreverData("clients.json", []);

const {
  ValidationError,
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} = await import("../src/lib/clients/repository");

const criar = (over: Partial<Parameters<typeof createClient>[1]> = {}) =>
  createClient(AGENCIA_A, { name: "Clínica Aurora", ...over });

describe("createClient", () => {
  test("preenche os padrões de quem não mandou nada", async () => {
    const c = await criar({ name: "  Café Raízes  " });
    assert.equal(c.name, "Café Raízes", "nome é aparado");
    assert.equal(c.segment, "");
    assert.deepEqual(c.services, []);
    assert.equal(c.owner, "—");
    assert.equal(c.billingDay, null);
    assert.equal(c.status, "novo", "cliente novo nasce no degrau 'Novo'");
    assert.ok(Date.parse(c.createdAt) > 0, "createdAt é ISO");
  });

  test("nome obrigatório", async () => {
    await assert.rejects(() => criar({ name: "" }), ValidationError);
    await assert.rejects(() => criar({ name: "   " }), ValidationError);
  });

  test("serviços: sem espaço sobrando, sem repetição, no máximo 8", async () => {
    const c = await criar({
      services: [
        " Instagram ",
        "Instagram",
        "Blog",
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
      ],
    });
    assert.deepEqual(c.services.slice(0, 3), ["Instagram", "Blog", "a"]);
    assert.equal(c.services.length, 8);
  });

  test("dia do faturamento aceita 1–31 e recusa o resto", async () => {
    assert.equal((await criar({ billingDay: 1 })).billingDay, 1);
    assert.equal((await criar({ billingDay: 31 })).billingDay, 31);
    assert.equal((await criar({ billingDay: null })).billingDay, null);
    await assert.rejects(() => criar({ billingDay: 0 }), ValidationError);
    await assert.rejects(() => criar({ billingDay: 32 }), ValidationError);
    await assert.rejects(
      () => criar({ billingDay: 12.5 as never }),
      ValidationError,
    );
  });

  test("status inválido cai no padrão em vez de gravar lixo", async () => {
    const c = await criar({ status: "campeao" as never });
    assert.equal(c.status, "novo");
  });
});

describe("listClients", () => {
  test("devolve em ordem alfabética", async () => {
    escreverData("clients.json", []);
    await criar({ name: "Zeta" });
    await criar({ name: "Alfa" });
    await criar({ name: "Ômega" });
    const nomes = (await listClients(AGENCIA_A)).map((c) => c.name);
    assert.deepEqual(nomes, ["Alfa", "Ômega", "Zeta"]);
  });
});

describe("updateClient", () => {
  test("altera só o que veio no patch", async () => {
    const c = await criar({ name: "Pet Vida", segment: "Pet shop" });
    const up = await updateClient(AGENCIA_A, c.id, { status: "risco" });
    assert.equal(up?.status, "risco");
    assert.equal(up?.segment, "Pet shop", "o que não veio no patch não muda");
  });

  test("nome não pode ficar vazio", async () => {
    const c = await criar();
    await assert.rejects(
      () => updateClient(AGENCIA_A, c.id, { name: "  " }),
      ValidationError,
    );
  });

  test("valida antes de abrir a transação", async () => {
    const c = await criar({ billingDay: 10 });
    await assert.rejects(
      () => updateClient(AGENCIA_A, c.id, { billingDay: 99 }),
      ValidationError,
    );
    assert.equal(
      (await getClient(AGENCIA_A, c.id))?.billingDay,
      10,
      "o valor antigo continua lá",
    );
  });
});

describe("contato da ficha (cidade, e-mail, telefone)", () => {
  test("nasce vazio e entra aparado", async () => {
    const vazio = await criar({ name: "Sem contato" });
    assert.equal(vazio.city, "");
    assert.equal(vazio.email, "");
    assert.equal(vazio.phone, "");

    const c = await criar({
      name: "Studio Raiz",
      city: "  Sorocaba ",
      email: " alo@studioraiz.com ",
      phone: " +55 15 99171-8747 ",
    });
    assert.equal(c.city, "Sorocaba");
    assert.equal(c.email, "alo@studioraiz.com");
    assert.equal(c.phone, "+55 15 99171-8747");
  });

  test("e-mail que não é e-mail é recusado, na criação e na edição", async () => {
    await assert.rejects(() => criar({ email: "alo(arroba)studioraiz" }), ValidationError);
    const c = await criar({ name: "Para editar" });
    await assert.rejects(
      () => updateClient(AGENCIA_A, c.id, { email: "sem arroba" }),
      ValidationError,
    );
    assert.equal(
      (await getClient(AGENCIA_A, c.id))?.email,
      "",
      "a recusa não deixa meia gravação atrás",
    );
  });

  test("apagar o contato é permitido — a ficha não exige contato", async () => {
    const c = await criar({ email: "alo@studioraiz.com", city: "Sorocaba" });
    const limpo = await updateClient(AGENCIA_A, c.id, { email: "", city: "" });
    assert.equal(limpo?.email, "");
    assert.equal(limpo?.city, "");
  });
});

describe("isolamento entre agências", () => {
  test("cliente de outra agência não aparece, não lê, não altera, não some", async () => {
    escreverData("clients.json", []);
    const daA = await criar({ name: "Só da A" });

    assert.deepEqual(await listClients(AGENCIA_B), [], "B não lista o da A");
    assert.equal(await getClient(AGENCIA_B, daA.id), undefined);
    assert.equal(
      await updateClient(AGENCIA_B, daA.id, { name: "Roubado" }),
      undefined,
    );
    assert.equal(await deleteClient(AGENCIA_B, daA.id), false);
    assert.equal(
      (await getClient(AGENCIA_A, daA.id))?.name,
      "Só da A",
      "o registro da A segue intacto",
    );
  });
});

describe("deleteClient", () => {
  test("remove e responde false na segunda vez", async () => {
    const c = await criar();
    assert.equal(await deleteClient(AGENCIA_A, c.id), true);
    assert.equal(await deleteClient(AGENCIA_A, c.id), false);
  });
});

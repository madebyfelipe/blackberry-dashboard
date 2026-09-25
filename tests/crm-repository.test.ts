import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("crm");
escreverData("crm.json", []);

const {
  ValidationError,
  addEvent,
  addFile,
  addService,
  deleteAccount,
  generateInvoice,
  getAccount,
  moveFile,
  removeFile,
  removeService,
  setInvoiceStatus,
  updateContract,
  updateService,
} = await import("../src/lib/crm/repository");

const NOW = new Date(2026, 8, 25, 10);

describe("ficha em branco", () => {
  test("cliente sem conta devolve a ficha vazia, sem gravar", async () => {
    const a = await getAccount(AGENCIA_A, "sem-conta");
    assert.deepEqual(a.services, []);
    assert.equal(a.payment, null);
    assert.equal(a.contract.cycle, "mensal");
  });
});

describe("serviços", () => {
  test("adiciona normalizado, edita e remove", async () => {
    let a = await addService(AGENCIA_A, "c1", { name: "  Gestão de Instagram ", monthlyValue: 320000, quota: 12, unit: "posts", delivered: 3, kind: "instagram" }, NOW);
    const s = a.services[0];
    assert.equal(s.name, "Gestão de Instagram");
    assert.equal(s.deliveredMonth, "2026-09");
    assert.equal(s.delivered, 3);

    a = (await updateService(AGENCIA_A, "c1", s.id, { delivered: 10, status: "setup" }, NOW))!;
    assert.equal(a.services[0].delivered, 10);
    assert.equal(a.services[0].status, "setup");

    assert.equal(await updateService(AGENCIA_A, "c1", "nao-existe", { name: "x" }), undefined);
    a = (await removeService(AGENCIA_A, "c1", s.id))!;
    assert.deepEqual(a.services, []);
  });

  test("recusa sem nome e status inválido; valor negativo vira zero", async () => {
    await assert.rejects(() => addService(AGENCIA_A, "c1", { name: "  " }), ValidationError);
    await assert.rejects(() => addService(AGENCIA_A, "c1", { name: "x", status: "vendido" as never }), ValidationError);
    const a = await addService(AGENCIA_A, "c1", { name: "Negativo", monthlyValue: -500 });
    assert.equal(a.services.at(-1)?.monthlyValue, 0);
  });
});

describe("faturas", () => {
  test("gerar cobrança usa os serviços, o dia do faturamento e a forma de pagamento", async () => {
    escreverData("crm.json", []);
    await addService(AGENCIA_A, "c2", { name: "Blog", monthlyValue: 210000 });
    await addService(AGENCIA_A, "c2", { name: "Pausado", monthlyValue: 99900, status: "pausado" });
    await updateContract(AGENCIA_A, "c2", { payment: { kind: "boleto" } });

    const a = await generateInvoice(AGENCIA_A, "c2", { billingDay: 5, now: NOW });
    const i = a.invoices[0];
    assert.equal(i.amount, 210000, "pausado não entra");
    assert.equal(i.competence, "2026-10");
    assert.equal(i.dueDate, "2026-10-05");
    assert.equal(i.method, "boleto");
    assert.equal(i.status, "aberto");

    await assert.rejects(() => generateInvoice(AGENCIA_A, "c2", { billingDay: 5, now: NOW }), /em aberto/);

    const paid = (await setInvoiceStatus(AGENCIA_A, "c2", i.id, "pago", NOW))!;
    assert.equal(paid.invoices[0].status, "pago");
    assert.equal(paid.invoices[0].paidAt, NOW.toISOString());

    const next = await generateInvoice(AGENCIA_A, "c2", { billingDay: 5, now: NOW });
    assert.equal(next.invoices.at(-1)?.competence, "2026-11", "outubro já faturado: vai para novembro");
  });

  test("sem dia de faturamento ou sem serviço, não gera", async () => {
    await assert.rejects(() => generateInvoice(AGENCIA_A, "c2", { billingDay: null, now: NOW }), ValidationError);
    await assert.rejects(() => generateInvoice(AGENCIA_A, "vazio", { billingDay: 5, now: NOW }), /Nenhum serviço/);
    assert.deepEqual((await getAccount(AGENCIA_A, "vazio")).invoices, [], "recusa não deixa conta pela metade");
  });
});

describe("contrato e pagamento", () => {
  test("guarda só o final do cartão e recusa o número inteiro", async () => {
    const a = await updateContract(AGENCIA_A, "c3", {
      payment: { kind: "cartao", brand: "Visa", last4: "4821", expires: "08/28" },
      contract: { startDate: "2025-01-01", fidelityMonths: 12, adjustmentIndex: "IPCA" },
    });
    assert.deepEqual(a.payment, { kind: "cartao", brand: "Visa", last4: "4821", expires: "08/28" });
    assert.equal(a.contract.fidelityMonths, 12);
    await assert.rejects(
      () => updateContract(AGENCIA_A, "c3", { payment: { kind: "cartao", last4: "4111 1111 1111 1111" } }),
      /4 últimos/,
    );
    const pix = await updateContract(AGENCIA_A, "c3", { payment: { kind: "pix", last4: "9999" } });
    assert.equal(pix.payment?.last4, "", "pix não guarda final de cartão");
    assert.equal((await updateContract(AGENCIA_A, "c3", { payment: null })).payment, null);
  });

  test("data de início inválida é recusada, e o contrato fica como estava", async () => {
    await assert.rejects(() => updateContract(AGENCIA_A, "c3", { contract: { startDate: "31/12/2025" } }), /início/);
    assert.equal((await getAccount(AGENCIA_A, "c3")).contract.startDate, "2025-01-01");
  });
});

describe("arquivos e agenda", () => {
  test("arquivo entra, muda de pasta e sai devolvendo o media id", async () => {
    let a = await addFile(AGENCIA_A, "c4", { mediaId: "m1", name: "Contrato.pdf", mime: "application/pdf", size: 1200, folder: "contratos", uploadedBy: "Felipe" });
    const f = a.files[0];
    a = (await moveFile(AGENCIA_A, "c4", f.id, "briefings"))!;
    assert.equal(a.files[0].folder, "briefings");
    await assert.rejects(() => moveFile(AGENCIA_A, "c4", f.id, "lixo" as never), ValidationError);
    const out = await removeFile(AGENCIA_A, "c4", f.id);
    assert.equal(out?.mediaId, "m1");
    assert.deepEqual(out?.account.files, []);
  });

  test("evento precisa de título e data", async () => {
    await assert.rejects(() => addEvent(AGENCIA_A, "c4", { title: "", at: NOW.toISOString(), createdBy: "F" }), ValidationError);
    await assert.rejects(() => addEvent(AGENCIA_A, "c4", { title: "Reunião", at: "amanhã", createdBy: "F" }), ValidationError);
    const a = await addEvent(AGENCIA_A, "c4", { title: "Reunião", kind: "reuniao", at: NOW.toISOString(), place: "Online", createdBy: "Felipe" });
    assert.equal(a.events[0].createdBy, "Felipe");
  });
});

describe("isolamento entre agências", () => {
  test("a ficha de um cliente da A não existe para a B", async () => {
    escreverData("crm.json", []);
    await addService(AGENCIA_A, "cx", { name: "Só da A", monthlyValue: 1000 });
    assert.deepEqual((await getAccount(AGENCIA_B, "cx")).services, []);
    assert.equal(await removeService(AGENCIA_B, "cx", (await getAccount(AGENCIA_A, "cx")).services[0].id), undefined);
    assert.equal((await getAccount(AGENCIA_A, "cx")).services.length, 1, "a da A segue intacta");
    assert.deepEqual(await deleteAccount(AGENCIA_B, "cx"), []);
  });

  test("apagar a conta devolve os arquivos para apagar", async () => {
    await addFile(AGENCIA_A, "cx", { mediaId: "m9", name: "a.pdf", mime: "application/pdf", size: 1, folder: "contratos", uploadedBy: "F" });
    assert.deepEqual(await deleteAccount(AGENCIA_A, "cx"), ["m9"]);
    assert.deepEqual((await getAccount(AGENCIA_A, "cx")).files, []);
  });
});

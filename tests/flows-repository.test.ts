import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("flows");
escreverData("flows.json", []);
escreverData("clients.json", []);

const { ValidationError, createFlow, duplicateFlow, getFlow, updateFlow, flowForClient } = await import(
  "../src/lib/flows/repository"
);
const { syncFlowClients } = await import("../src/lib/flows/clients");
const { createClient, findClientByName, findClientForRecord, getClient, setFlowClients, updateClient } = await import(
  "../src/lib/clients/repository"
);

describe("createFlow (Novo fluxo)", () => {
  test("o modelo traz as etapas e a identidade; o passo Detalhes vence", async () => {
    const f = await createFlow(AGENCIA_A, {
      name: "  Blog da Aurora ",
      by: "Felipe",
      template: "blog",
      description: "Artigos mensais",
      color: "green",
      appliesTo: "todos",
      status: "inativo",
    });
    assert.equal(f.name, "Blog da Aurora");
    assert.deepEqual(f.steps.map((s) => s.name), ["Pauta", "Redação", "SEO", "Revisão", "Publicação"]);
    assert.equal(f.icon, "pen-line", "sem ícone escolhido: o do modelo");
    assert.equal(f.color, "green");
    assert.equal(f.category, "marketing");
    assert.equal(f.description, "Artigos mensais");
    assert.equal(f.appliesTo, "todos");
    assert.equal(f.status, "inativo");
    assert.equal(f.updatedBy, "Felipe");
  });

  test("começar do zero nasce sem etapa e desligado", async () => {
    const f = await createFlow(AGENCIA_A, { name: "Do zero", by: "Felipe", template: "zero" });
    assert.deepEqual(f.steps, []);
    assert.equal(f.status, "inativo");
    assert.equal(f.appliesTo, "especificos", "sem escolha: só os clientes atribuídos");
  });

  test("salvar rascunho", async () => {
    const f = await createFlow(AGENCIA_A, { name: "Rascunho", by: "Felipe", template: "social-media", status: "rascunho" });
    assert.equal(f.status, "rascunho");
    assert.equal(f.steps.length, 6);
  });

  test("nome obrigatório, e fluxo não nasce arquivado", async () => {
    await assert.rejects(() => createFlow(AGENCIA_A, { name: "  ", by: "x" }), ValidationError);
    await assert.rejects(
      () => createFlow(AGENCIA_A, { name: "x", by: "x", status: "arquivado" as never }),
      ValidationError,
    );
  });

  test("valor fora da régua cai no padrão do modelo", async () => {
    const f = await createFlow(AGENCIA_A, {
      name: "x",
      by: "x",
      template: "paid-media",
      icon: "caveira" as never,
      color: "#fff" as never,
      category: "nada" as never,
    });
    assert.equal(f.icon, "target");
    assert.equal(f.color, "orange");
    assert.equal(f.category, "midia-paga");
  });
});

describe("updateFlow (Editar → Detalhes)", () => {
  test("grava os campos novos e recusa valor inválido", async () => {
    const f = await createFlow(AGENCIA_A, { name: "Editar", by: "a", template: "blog" });
    const out = await updateFlow(
      AGENCIA_A,
      f.id,
      { description: " Nova ", category: "operacao", icon: "zap", color: "sky", appliesTo: "todos" },
      "b",
    );
    assert.equal(out?.description, "Nova");
    assert.equal(out?.category, "operacao");
    assert.equal(out?.icon, "zap");
    assert.equal(out?.color, "sky");
    assert.equal(out?.appliesTo, "todos");
    await assert.rejects(() => updateFlow(AGENCIA_A, f.id, { color: "roxo" as never }, "b"), ValidationError);
    await assert.rejects(() => updateFlow(AGENCIA_A, f.id, { appliesTo: "alguns" as never }, "b"), ValidationError);
  });

  test("fluxo de outra agência não existe", async () => {
    const f = await createFlow(AGENCIA_A, { name: "Da A", by: "a", template: "blog" });
    assert.equal(await updateFlow(AGENCIA_B, f.id, { name: "Roubado" }, "b"), undefined);
    assert.equal((await getFlow(AGENCIA_A, f.id))?.name, "Da A");
  });
});

describe("clientes do fluxo", () => {
  test("específico só pega quem foi atribuído; todos pega quem não tem fluxo", async () => {
    escreverData("flows.json", []);
    escreverData("clients.json", []);
    const aurora = await createClient(AGENCIA_A, { name: "Clínica Aurora" });
    const bloom = await createClient(AGENCIA_A, { name: "Casa Bloom" });
    const padrao = await createFlow(AGENCIA_A, { name: "Padrão", by: "a", template: "social-media", appliesTo: "todos" });
    const esp = await createFlow(AGENCIA_A, { name: "Blog", by: "a", template: "blog", appliesTo: "especificos", status: "ativo" });

    await setFlowClients(AGENCIA_A, esp.id, [aurora.id]);
    assert.equal((await flowForClient(AGENCIA_A, (await getClient(AGENCIA_A, aurora.id))?.flowId))?.id, esp.id);
    assert.equal((await flowForClient(AGENCIA_A, (await getClient(AGENCIA_A, bloom.id))?.flowId))?.id, padrao.id);
  });

  test("setFlowClients troca a lista inteira, sem tocar em outra agência", async () => {
    escreverData("clients.json", []);
    const a = await createClient(AGENCIA_A, { name: "A", flowId: "outro" });
    const b = await createClient(AGENCIA_A, { name: "B", flowId: "f1" });
    const c = await createClient(AGENCIA_A, { name: "C" });
    const deB = await createClient(AGENCIA_B, { name: "De B" });

    const mudou = await setFlowClients(AGENCIA_A, "f1", [a.id, c.id, deB.id]);
    assert.deepEqual(mudou.map((x) => x.name).sort(), ["A", "B", "C"]);
    assert.equal((await getClient(AGENCIA_A, a.id))?.flowId, "f1", "sai do outro fluxo e entra neste");
    assert.equal((await getClient(AGENCIA_A, b.id))?.flowId, null, "ficou de fora: volta ao padrão");
    assert.equal((await getClient(AGENCIA_A, c.id))?.flowId, "f1");
    assert.equal((await getClient(AGENCIA_B, deB.id))?.flowId, null, "id de outra agência é ignorado");

    assert.deepEqual(await setFlowClients(AGENCIA_A, "f1", [a.id, c.id]), [], "nada muda: nada volta");
  });
});

describe("o cliente do lote sai do clientId, não do nome (#80)", () => {
  test("renomear a ficha mantém o fluxo próprio e o squad dos criativos novos", async () => {
    escreverData("flows.json", []);
    escreverData("clients.json", []);
    await createFlow(AGENCIA_A, { name: "Todos os clientes", by: "a", template: "social-media", appliesTo: "todos" });
    const paid = await createFlow(AGENCIA_A, { name: "Paid Media", by: "a", template: "paid-media", appliesTo: "especificos", status: "ativo" });
    const aurora = await createClient(AGENCIA_A, { name: "Aurora", squad: ["m-ana"], owner: "Ana" });
    await setFlowClients(AGENCIA_A, paid.id, [aurora.id]);
    // O lote gravou "Aurora" e o id; depois a ficha foi renomeada.
    const lote = { client: "Aurora", clientId: aurora.id };
    await updateClient(AGENCIA_A, aurora.id, { name: "Clínica Aurora" });

    assert.equal(await findClientByName(AGENCIA_A, lote.client), undefined, "pelo nome, o cliente sumiu");
    const ficha = await findClientForRecord(AGENCIA_A, lote);
    assert.equal(ficha?.id, aurora.id);
    assert.deepEqual(ficha?.squad, ["m-ana"]);
    assert.equal((await flowForClient(AGENCIA_A, ficha?.flowId))?.id, paid.id, "não cai no padrão");
  });

  test("sem clientId (ou com id de ficha apagada), o nome ainda resolve", async () => {
    escreverData("clients.json", []);
    const bloom = await createClient(AGENCIA_A, { name: "Casa Bloom" });
    assert.equal((await findClientForRecord(AGENCIA_A, { client: "casa bloom", clientId: null }))?.id, bloom.id);
    assert.equal((await findClientForRecord(AGENCIA_A, { client: "Casa Bloom", clientId: "apagado" }))?.id, bloom.id);
    assert.equal(await findClientForRecord(AGENCIA_A, { client: "Ninguém", clientId: null }), undefined);
  });

  test("clientId de outra agência não vale", async () => {
    escreverData("clients.json", []);
    const deB = await createClient(AGENCIA_B, { name: "De B" });
    assert.equal(await findClientForRecord(AGENCIA_A, { client: "", clientId: deB.id }), undefined);
  });
});

describe("Clientes específicos de fluxo que ainda não recebe trabalho (#96)", () => {
  async function cenario() {
    escreverData("flows.json", []);
    escreverData("clients.json", []);
    await createFlow(AGENCIA_A, { name: "Todos", by: "a", template: "social-media", appliesTo: "todos" });
    const paid = await createFlow(AGENCIA_A, { name: "Paid", by: "a", template: "paid-media", appliesTo: "especificos", status: "ativo" });
    const aurora = await createClient(AGENCIA_A, { name: "Aurora" });
    await setFlowClients(AGENCIA_A, paid.id, [aurora.id]);
    const fluxoDe = async (id: string) => (await flowForClient(AGENCIA_A, (await getClient(AGENCIA_A, id))?.flowId))?.id;
    return { paid, aurora, fluxoDe };
  }

  test("salvar rascunho não tira ninguém do fluxo atual — a lista fica guardada", async () => {
    const { paid, aurora, fluxoDe } = await cenario();
    const rascunho = await createFlow(AGENCIA_A, { name: "Novo", by: "a", template: "social-media", appliesTo: "especificos", status: "rascunho" });
    const salvo = await syncFlowClients(AGENCIA_A, rascunho, [aurora.id]);

    assert.deepEqual(salvo.pendingClientIds, [aurora.id]);
    assert.equal((await getClient(AGENCIA_A, aurora.id))?.flowId, paid.id, "continua no Paid");
    assert.equal(await fluxoDe(aurora.id), paid.id, "o criativo segue indo para o Paid, não para o padrão");
  });

  test("ativo mas sem etapa (Começar do zero) também espera", async () => {
    const { paid, aurora, fluxoDe } = await cenario();
    const zero = await createFlow(AGENCIA_A, { name: "Zero", by: "a", template: "zero", appliesTo: "especificos", status: "ativo" });
    await syncFlowClients(AGENCIA_A, zero, [aurora.id]);
    assert.equal(await fluxoDe(aurora.id), paid.id);
  });

  test("editar o rascunho sem mandar a lista não mexe nela", async () => {
    const { aurora } = await cenario();
    const rascunho = await createFlow(AGENCIA_A, { name: "Novo", by: "a", template: "social-media", status: "rascunho" });
    await syncFlowClients(AGENCIA_A, rascunho, [aurora.id]);
    const editado = (await updateFlow(AGENCIA_A, rascunho.id, { name: "Novo 2" }, "a"))!;
    assert.deepEqual((await syncFlowClients(AGENCIA_A, editado)).pendingClientIds, [aurora.id]);
  });

  test("ficou pronto: a lista guardada é aplicada e some", async () => {
    const { aurora, fluxoDe } = await cenario();
    const rascunho = await createFlow(AGENCIA_A, { name: "Novo", by: "a", template: "social-media", status: "rascunho" });
    await syncFlowClients(AGENCIA_A, rascunho, [aurora.id]);

    const ativado = (await updateFlow(AGENCIA_A, rascunho.id, { status: "ativo" }, "a"))!;
    const final = await syncFlowClients(AGENCIA_A, ativado);
    assert.equal(final.pendingClientIds, null);
    assert.equal((await getClient(AGENCIA_A, aurora.id))?.flowId, rascunho.id);
    assert.equal(await fluxoDe(aurora.id), rascunho.id);
  });

  test("fluxo que já nasce pronto leva os clientes na hora, como antes", async () => {
    const { aurora, fluxoDe } = await cenario();
    const pronto = await createFlow(AGENCIA_A, { name: "Pronto", by: "a", template: "blog", appliesTo: "especificos", status: "ativo" });
    const salvo = await syncFlowClients(AGENCIA_A, pronto, [aurora.id]);
    assert.equal(salvo.pendingClientIds, null);
    assert.equal(await fluxoDe(aurora.id), pronto.id);
  });

  test("a cópia do fluxo não leva a lista guardada", async () => {
    const { aurora } = await cenario();
    const rascunho = await createFlow(AGENCIA_A, { name: "Novo", by: "a", template: "social-media", status: "rascunho" });
    await syncFlowClients(AGENCIA_A, rascunho, [aurora.id]);
    assert.equal((await duplicateFlow(AGENCIA_A, rascunho.id, "a"))?.pendingClientIds, null);
  });
});

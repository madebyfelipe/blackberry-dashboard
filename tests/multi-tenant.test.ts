import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

/*
 * O teste que a issue #12 pede: a agência A não lê nem altera nada da agência
 * B — nem pela lista, nem pelo id direto, nem por uma escrita.
 *
 * O arquivo monta a base ANTES de importar os stores (ver helpers/data-dir):
 * dois lotes, um de cada agência, mais um lote e uma tarefa sem `agencyId`
 * para provar a migração dos dados anteriores ao multi-tenant.
 */
usarDataDirTemporario("multi-tenant");

const peca = (id: string) => ({
  id,
  name: `Peça ${id}`,
  size: "1080 x 1080",
  date: "2026-09-10T08:00:00.000Z",
  status: "pendente",
  kind: "Feed · imagem única",
  caption: "Legenda original",
  history: [],
});

escreverData("batches.json", [
  {
    id: "lote-a",
    agencyId: AGENCIA_A.agencyId,
    client: "Clínica Aurora",
    label: "Lote setembro",
    token: "tokenDaAgenciaA",
    pieces: [peca("pa1")],
  },
  {
    id: "lote-b",
    agencyId: AGENCIA_B.agencyId,
    client: "Montê bar",
    label: "Lote setembro",
    token: "tokenDaAgenciaB",
    pieces: [peca("pb1")],
  },
  {
    // Gravado antes do multi-tenant: sem `agencyId`.
    id: "lote-antigo",
    client: "Cliente de antes",
    label: "Lote agosto",
    token: "tokenDoLoteAntigo",
    pieces: [peca("pv1")],
  },
]);

// Conta gravada antes do multi-tenant: tem o nome da agência, não o id.
escreverData("users.json", [
  {
    id: "u1",
    name: "Felipe",
    email: "felipe@blackberry.app",
    role: "coordenacao",
    agency: "Estúdio Norte",
    passwordHash: "scrypt$00$00",
    passwordVersion: 1,
    createdAt: "2026-09-01T09:00:00.000Z",
  },
]);

escreverData("tasks.json", [
  {
    id: "t-antiga",
    title: "Tarefa de antes do multi-tenant",
    client: "Cliente de antes",
    status: "a-fazer",
    assignee: "F",
    createdAt: "2026-09-01T09:00:00.000Z",
  },
]);

const { LEGACY_AGENCY_ID, LEGACY_AGENCY_NAME, agencyScope } = await import(
  "../src/lib/agency/id"
);
const tarefas = await import("../src/lib/tasks/repository");
const lotes = await import("../src/lib/approval/repository");
const contas = await import("../src/lib/auth/repository");

/** A agência semeada, que é o destino da migração. */
const HERDEIRA = agencyScope({
  agencyId: LEGACY_AGENCY_ID,
  agency: LEGACY_AGENCY_NAME,
});

describe("tarefas: A não lê nem altera o que é de B", () => {
  test("cada agência só lista as próprias tarefas", async () => {
    const daA = await tarefas.createTask(AGENCIA_A, {
      title: "Arte do carrossel",
      client: "Clínica Aurora",
    });
    const daB = await tarefas.createTask(AGENCIA_B, {
      title: "Roteiro do Reels",
      client: "Montê bar",
    });

    const listaA = (await tarefas.listTasks(AGENCIA_A)).map((t) => t.id);
    const listaB = (await tarefas.listTasks(AGENCIA_B)).map((t) => t.id);

    assert.ok(listaA.includes(daA.id));
    assert.ok(!listaA.includes(daB.id), "A não pode ver tarefa de B");
    assert.ok(listaB.includes(daB.id));
    assert.ok(!listaB.includes(daA.id), "B não pode ver tarefa de A");
  });

  test("a tarefa nasce com a agência do escopo, não com a que pedirem", async () => {
    const t = await tarefas.createTask(AGENCIA_A, {
      title: "Com dono certo",
      client: "Clínica Aurora",
      // `NewTask` não tem `agencyId`; se alguém empurrar um, é para ser ignorado.
      ...({ agencyId: AGENCIA_B.agencyId } as object),
    });
    assert.equal(t.agencyId, AGENCIA_A.agencyId);
    assert.equal(await tarefas.getTask(AGENCIA_B, t.id), undefined);
  });

  test("ler por id não atravessa a fronteira", async () => {
    const daB = await tarefas.createTask(AGENCIA_B, {
      title: "Só de B",
      client: "Montê bar",
    });
    assert.equal(
      await tarefas.getTask(AGENCIA_A, daB.id),
      undefined,
      "id certo, agência errada: não existe",
    );
    assert.equal((await tarefas.getTask(AGENCIA_B, daB.id))?.title, "Só de B");
  });

  test("editar tarefa de outra agência não muda nada", async () => {
    const daB = await tarefas.createTask(AGENCIA_B, {
      title: "Intacta",
      client: "Montê bar",
      status: "a-fazer",
    });
    assert.equal(
      await tarefas.updateTask(AGENCIA_A, daB.id, {
        title: "Invadida",
        status: "concluido",
      }),
      undefined,
    );
    const depois = await tarefas.getTask(AGENCIA_B, daB.id);
    assert.equal(depois?.title, "Intacta");
    assert.equal(depois?.status, "a-fazer");
  });

  test("apagar tarefa de outra agência não apaga", async () => {
    const daB = await tarefas.createTask(AGENCIA_B, {
      title: "Sobrevivente",
      client: "Montê bar",
    });
    assert.equal(await tarefas.deleteTask(AGENCIA_A, daB.id), false);
    assert.ok(await tarefas.getTask(AGENCIA_B, daB.id), "continua lá");
    assert.equal(await tarefas.deleteTask(AGENCIA_B, daB.id), true);
  });
});

describe("lotes: A não lê nem altera o que é de B", () => {
  test("cada agência só lista os próprios lotes", async () => {
    assert.deepEqual(
      (await lotes.listBatches(AGENCIA_A)).map((b) => b.id),
      ["lote-a"],
    );
    assert.deepEqual(
      (await lotes.listBatches(AGENCIA_B)).map((b) => b.id),
      ["lote-b"],
    );
  });

  test("abrir o lote da outra agência é 'não existe'", async () => {
    assert.equal(await lotes.getBatch(AGENCIA_A, "lote-b"), undefined);
    assert.equal(await lotes.getBatch(AGENCIA_B, "lote-a"), undefined);
    assert.ok(await lotes.getBatch(AGENCIA_B, "lote-b"));
  });

  test("nenhuma escrita da agência alcança o lote da outra", async () => {
    const antes = await lotes.getBatch(AGENCIA_B, "lote-b");

    assert.equal(
      await lotes.updatePieceDraft(AGENCIA_A, "lote-b", "pb1", {
        caption: "Legenda invadida",
      }),
      undefined,
    );
    assert.equal(await lotes.addPiece(AGENCIA_A, "lote-b"), undefined);
    assert.equal(
      await lotes.removePieceMedia(AGENCIA_A, "lote-b", "pb1", "qualquer-media-id"),
      undefined,
    );
    assert.equal(
      await lotes.approvePieceByAgency(AGENCIA_A, "lote-b", "pb1"),
      undefined,
    );
    assert.equal(
      await lotes.markPieceRedone(AGENCIA_A, "lote-b", "pb1"),
      undefined,
    );
    assert.equal(await lotes.sendBatchForApproval(AGENCIA_A, "lote-b"), undefined);
    assert.equal(await lotes.regenerateBatchToken(AGENCIA_A, "lote-b"), undefined);
    assert.equal(
      await lotes.setBatchLinkRevoked(AGENCIA_A, "lote-b", true),
      undefined,
    );

    const depois = await lotes.getBatch(AGENCIA_B, "lote-b");
    assert.deepEqual(depois, antes, "o lote de B saiu exatamente como entrou");
  });

  test("a agência mexe no próprio lote normalmente", async () => {
    const r = await lotes.updatePieceDraft(AGENCIA_B, "lote-b", "pb1", {
      caption: "Legenda nova",
    });
    assert.equal(r?.piece.caption, "Legenda nova");

    const aprovada = await lotes.approvePieceByAgency(AGENCIA_B, "lote-b", "pb1");
    assert.equal(aprovada?.status, "aprovado");
    assert.ok(
      aprovada?.history[0].who.startsWith(AGENCIA_B.agencyName),
      "o histórico leva o nome da agência da sessão, não um nome fixo no código",
    );
  });
});

describe("link público do cliente", () => {
  test("abre sem sessão e resolve exatamente o lote do token", async () => {
    const porToken = await lotes.getBatchByToken("tokenDaAgenciaB");
    assert.equal(porToken?.id, "lote-b");
    assert.equal(
      (await lotes.getBatchByToken("tokenDaAgenciaA"))?.id,
      "lote-a",
    );
  });

  test("token vazio ou desconhecido não abre nada", async () => {
    assert.equal(await lotes.getBatchByToken(""), undefined);
    assert.equal(await lotes.getBatchByToken("naoExiste"), undefined);
  });

  test("a decisão do cliente continua funcionando, sem sessão", async () => {
    const piece = await lotes.decidePiece("tokenDaAgenciaA", "pa1", "ajuste", {
      reason: "Trocar a cor do texto.",
      who: "Marina Duarte",
      ip: "203.0.113.7",
    });
    assert.notEqual(piece, undefined);
    assert.notEqual(piece, "inactive-link");
    const decidida = piece as Exclude<typeof piece, undefined | "inactive-link">;
    assert.equal(decidida.status, "ajuste");
    assert.equal(decidida.reason, "Trocar a cor do texto.");
    assert.equal(decidida.history[0].ip, "203.0.113.7");
  });

  test("o token de um lote não alcança a peça de outro", async () => {
    const antes = (await lotes.getBatch(AGENCIA_B, "lote-b"))!.pieces[0];
    assert.equal(
      await lotes.decidePiece("tokenDaAgenciaA", "pb1", "aprovado"),
      undefined,
      "peça de B com o token de A: não existe",
    );
    const depois = (await lotes.getBatch(AGENCIA_B, "lote-b"))!.pieces[0];
    assert.deepEqual(depois, antes, "a peça de B não se mexeu");
  });

  test("regenerar o link troca o token e o novo abre o mesmo lote", async () => {
    const antigo = (await lotes.getBatch(AGENCIA_A, "lote-a"))!.token;
    const novo = (await lotes.regenerateBatchToken(AGENCIA_A, "lote-a"))!.token;
    assert.notEqual(novo, antigo);
    assert.equal((await lotes.getBatchByToken(novo))?.id, "lote-a");
    assert.equal(await lotes.getBatchByToken(antigo), undefined, "o antigo morre");
  });

  test("revogar o link fecha a porta da decisão, sem apagar o lote", async () => {
    await lotes.setBatchLinkRevoked(AGENCIA_B, "lote-b", true);
    const token = (await lotes.getBatch(AGENCIA_B, "lote-b"))!.token;
    assert.equal(
      await lotes.decidePiece(token, "pb1", "aprovado"),
      "inactive-link",
    );
    await lotes.setBatchLinkRevoked(AGENCIA_B, "lote-b", false);
  });
});

describe("migração dos dados anteriores ao multi-tenant", () => {
  /*
   * A propriedade que sustenta tudo: a conta que já existia e os dados que já
   * existiam chegam ao MESMO tenant, sem ninguém rodar migração à mão. Se
   * caíssem em ids diferentes, o Felipe abriria o app e veria a lista vazia.
   */
  test("a conta que já existia herda o tenant do nome da agência", async () => {
    assert.equal((await contas.getUserById("u1"))?.agencyId, LEGACY_AGENCY_ID);
  });

  test("tarefa sem agência vai para a agência semeada, e só para ela", async () => {
    assert.equal((await tarefas.getTask(HERDEIRA, "t-antiga"))?.agencyId, LEGACY_AGENCY_ID);
    assert.equal(await tarefas.getTask(AGENCIA_A, "t-antiga"), undefined);
    assert.equal(await tarefas.getTask(AGENCIA_B, "t-antiga"), undefined);
  });

  test("lote sem agência também — nada some, nada vaza", async () => {
    assert.deepEqual(
      (await lotes.listBatches(HERDEIRA)).map((b) => b.id),
      ["lote-antigo"],
    );
    assert.equal(await lotes.getBatch(AGENCIA_A, "lote-antigo"), undefined);
  });

  test("o link público do lote antigo continua de pé", async () => {
    assert.equal(
      (await lotes.getBatchByToken("tokenDoLoteAntigo"))?.id,
      "lote-antigo",
    );
  });
});

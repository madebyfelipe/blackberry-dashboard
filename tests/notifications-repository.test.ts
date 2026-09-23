import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

usarDataDirTemporario("notificacoes");

const {
  deleteNotification,
  listNotifications,
  markNotifications,
  pushNotifications,
  unreadNotifications,
} = await import("../src/lib/notifications/repository");

const aviso = (recipientId: string, over: Record<string, string> = {}) => ({
  recipientId,
  kind: "mencao" as const,
  actor: "Felipe",
  title: "Felipe te marcou",
  body: "",
  href: "/tarefas/t1",
  ref: "tarefa:t1",
  ...over,
});

describe("as notificações de cada um", () => {
  test("cada pessoa lê só as suas, e só na sua agência", async () => {
    await pushNotifications(AGENCIA_A, [aviso("marina"), aviso("ana")]);
    await pushNotifications(AGENCIA_B, [aviso("marina")]);
    assert.equal((await listNotifications(AGENCIA_A, "marina")).length, 1);
    assert.equal((await listNotifications(AGENCIA_B, "marina")).length, 1);
    assert.equal((await listNotifications(AGENCIA_A, "ana")).length, 1);
  });

  test("abrir a coisa (ref) dá por lidas as dela — e só as suas", async () => {
    await pushNotifications(AGENCIA_A, [aviso("marina", { ref: "conversa:g1", href: "/inbox?conversa=g1" })]);
    assert.equal(await unreadNotifications(AGENCIA_A, "marina"), 2);
    assert.equal(await markNotifications(AGENCIA_A, "marina", { ref: "tarefa:t1" }), 1);
    assert.equal(await unreadNotifications(AGENCIA_A, "marina"), 1);
    // A da Ana, do mesmo ref, continua não lida.
    assert.equal(await unreadNotifications(AGENCIA_A, "ana"), 1);
    // Nada a mudar: zero, sem erro.
    assert.equal(await markNotifications(AGENCIA_A, "marina", { ref: "tarefa:t1" }), 0);
  });

  test("todas como lidas, e de volta para não lida por id", async () => {
    await markNotifications(AGENCIA_A, "marina", { all: true });
    assert.equal(await unreadNotifications(AGENCIA_A, "marina"), 0);
    const [first] = await listNotifications(AGENCIA_A, "marina");
    await markNotifications(AGENCIA_A, "marina", { ids: [first.id] }, false);
    assert.equal(await unreadNotifications(AGENCIA_A, "marina"), 1);
  });

  test("tirar da lista: só a sua; a de outra pessoa responde como inexistente", async () => {
    const [daAna] = await listNotifications(AGENCIA_A, "ana");
    assert.equal(await deleteNotification(AGENCIA_A, "marina", daAna.id), false);
    assert.equal(await deleteNotification(AGENCIA_B, "ana", daAna.id), false);
    assert.equal(await deleteNotification(AGENCIA_A, "ana", daAna.id), true);
    assert.equal((await listNotifications(AGENCIA_A, "ana")).length, 0);
  });

  test("mensagens seguidas da mesma conversa somam numa notificação", async () => {
    const msg = { kind: "mensagem" as const, ref: "conversa:g9", href: "/inbox?conversa=g9" };
    await pushNotifications(AGENCIA_A, [{ ...aviso("bia"), ...msg }]);
    const [n] = await pushNotifications(AGENCIA_A, [{ ...aviso("bia"), ...msg, body: "segunda" }]);
    assert.equal(n.count, 2);
    assert.equal((await listNotifications(AGENCIA_A, "bia")).length, 1);
  });
});

describe("mensagem apagada", () => {
  test("o aviso com o texto dela passa a dizer que foi apagada — só naquela conversa", async () => {
    const msg = { kind: "mensagem" as const, ref: "conversa:g7", href: "/inbox?conversa=g7" };
    await pushNotifications(AGENCIA_A, [{ ...aviso("caio"), ...msg, body: "segredo" }]);
    await pushNotifications(AGENCIA_A, [{ ...aviso("caio"), ...msg, ref: "conversa:outra", body: "segredo" }]);
    const { redactNotifications } = await import("../src/lib/notifications/repository");
    assert.equal(await redactNotifications(AGENCIA_A, "conversa:g7", "segredo", "Mensagem apagada"), 1);
    const bodies = (await listNotifications(AGENCIA_A, "caio")).map((n) => `${n.ref}:${n.body}`).sort();
    assert.deepEqual(bodies, ["conversa:g7:Mensagem apagada", "conversa:outra:segredo"]);
  });
});

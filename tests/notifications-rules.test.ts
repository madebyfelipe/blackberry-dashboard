import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  SYSTEM_ACTOR,
  commentNotifications,
  memberByName,
  messageNotifications,
  taskNotifications,
  type Person,
} from "../src/lib/notifications/rules";

const TIME: Person[] = [
  { id: "felipe", name: "Felipe", handle: "felipe", status: "ativo" },
  { id: "marina", name: "Marina", handle: "marina", status: "ativo" },
  { id: "ana", name: "Ana Luísa", handle: "ana", status: "ativo" },
  { id: "rui", name: "Rui", handle: "rui", status: "arquivado" },
];

const FELIPE = { id: "felipe", name: "Felipe" };

const tarefa = (over: Partial<{ assignee: string; description: string }> = {}) => ({
  id: "t1",
  title: "Post Montê",
  client: "Montê bar",
  assignee: "—",
  description: "",
  ...over,
});

describe("tarefa: quem recebeu e quem foi marcado", () => {
  test("responsável novo recebe a atribuição, com link para a tarefa", () => {
    const out = taskNotifications(TIME, FELIPE, tarefa(), tarefa({ assignee: "Marina" }));
    assert.equal(out.length, 1);
    assert.equal(out[0].recipientId, "marina");
    assert.equal(out[0].kind, "atribuicao");
    assert.equal(out[0].href, "/tarefas/t1");
    assert.equal(out[0].ref, "tarefa:t1");
    assert.match(out[0].title, /Felipe atribuiu "Post Montê" a você/);
  });

  test("o nome casa sem acento nem caixa", () => {
    assert.equal(memberByName(TIME, "ana luisa")?.id, "ana");
  });

  test("atribuir a si mesmo não avisa ninguém", () => {
    assert.deepEqual(taskNotifications(TIME, FELIPE, tarefa(), tarefa({ assignee: "Felipe" })), []);
  });

  test("responsável que não mudou não avisa de novo", () => {
    const t = tarefa({ assignee: "Marina" });
    assert.deepEqual(taskNotifications(TIME, FELIPE, t, { ...t, title: "Outro" }), []);
  });

  test("quem está fora do time não recebe", () => {
    assert.deepEqual(taskNotifications(TIME, FELIPE, tarefa(), tarefa({ assignee: "Rui" })), []);
  });

  test("só a menção nova no briefing avisa, uma vez por pessoa", () => {
    const before = tarefa({ description: "@marina olha isso" });
    const after = tarefa({ description: "@marina olha isso\n\n@ana @ana e @rui também\n@felipe" });
    const out = taskNotifications(TIME, FELIPE, before, after);
    assert.deepEqual(out.map((n) => [n.recipientId, n.kind]), [["ana", "mencao"]]);
    assert.equal(out[0].body, "@ana @ana e @rui também");
  });

  test("quem recebeu e foi marcado junto ganha só a atribuição", () => {
    const out = taskNotifications(TIME, FELIPE, tarefa(), tarefa({ assignee: "Marina", description: "@marina" }));
    assert.deepEqual(out.map((n) => n.kind), ["atribuicao"]);
  });

  test("quando foi o fluxo, o título diz que a tarefa chegou", () => {
    const out = taskNotifications(TIME, { name: SYSTEM_ACTOR }, undefined, tarefa({ assignee: "Marina" }), "Design → Revisão");
    assert.equal(out[0].title, '"Post Montê" chegou para você');
    assert.equal(out[0].body, "Design → Revisão");
  });
});

describe("comentário", () => {
  test("marcado recebe menção; o responsável recebe o comentário", () => {
    const out = commentNotifications(TIME, FELIPE, tarefa({ assignee: "Marina" }), "@ana consegue ver?");
    assert.deepEqual(
      out.map((n) => [n.recipientId, n.kind]),
      [
        ["ana", "mencao"],
        ["marina", "comentario"],
      ],
    );
  });

  test("responsável marcado não recebe dois avisos; quem comentou, nenhum", () => {
    const out = commentNotifications(TIME, { id: "marina", name: "Marina" }, tarefa({ assignee: "Marina" }), "@marina @felipe");
    assert.deepEqual(out.map((n) => n.recipientId), ["felipe"]);
  });
});

describe("mensagem", () => {
  const conversa = {
    id: "g1",
    kind: "grupo" as const,
    group: "Montê bar",
    memberIds: ["felipe", "marina", "ana"],
    mutedBy: ["ana"],
  };

  test("quem está na conversa recebe; quem silenciou não; o autor não", () => {
    const out = messageNotifications(TIME, FELIPE, conversa, "subi os artes");
    assert.deepEqual(out.map((n) => [n.recipientId, n.kind]), [["marina", "mensagem"]]);
    assert.equal(out[0].title, "Felipe em Montê bar");
    assert.equal(out[0].href, "/inbox?conversa=g1");
    assert.equal(out[0].ref, "conversa:g1");
  });

  test("a menção fura o silêncio — é para isso que o @ existe", () => {
    const out = messageNotifications(TIME, FELIPE, conversa, "@ana preciso de você");
    assert.deepEqual(
      out.map((n) => [n.recipientId, n.kind]),
      [
        ["marina", "mensagem"],
        ["ana", "mencao"],
      ],
    );
  });

  test("marcar quem não está na conversa não avisa", () => {
    const out = messageNotifications(TIME, FELIPE, { ...conversa, memberIds: ["felipe", "marina"] }, "@ana");
    assert.deepEqual(out.map((n) => n.recipientId), ["marina"]);
  });
});

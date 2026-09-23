import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import {
  countLabel,
  excerpt,
  groupNotificationsByDay,
  inTab,
  mergeNotification,
  trimPerRecipient,
  unreadTotal,
} from "../src/lib/notifications/view";
import type { AppNotification, NotificationInput } from "../src/lib/notifications/types";

const base = (over: Partial<AppNotification> & { id: string }): AppNotification => ({
  agencyId: AGENCIA_A.agencyId,
  recipientId: "marina",
  kind: "mencao",
  actor: "Felipe",
  title: "t",
  body: "",
  href: "/tarefas/t1",
  ref: "tarefa:t1",
  count: 1,
  createdAt: "2026-09-20T10:00:00.000Z",
  readAt: null,
  ...over,
});

const input = (over: Partial<NotificationInput> = {}) => ({
  id: "novo",
  agencyId: AGENCIA_A.agencyId,
  recipientId: "marina",
  kind: "mensagem" as const,
  actor: "Felipe",
  title: "Felipe em Montê",
  body: "e aí?",
  href: "/inbox?conversa=g1",
  ref: "conversa:g1",
  ...over,
});

describe("mensagens da mesma conversa viram um aviso só", () => {
  test("não lida da mesma conversa soma o contador e sobe para o topo", () => {
    const list = [base({ id: "a", kind: "mencao" }), base({ id: "m", kind: "mensagem", ref: "conversa:g1" })];
    const { list: out, notification } = mergeNotification(list, input(), "2026-09-20T11:00:00.000Z");
    assert.equal(out.length, 2);
    assert.equal(out[0].id, "m");
    assert.equal(notification.count, 2);
    assert.equal(notification.body, "e aí?");
    assert.equal(notification.createdAt, "2026-09-20T11:00:00.000Z");
  });

  test("a já lida não soma: nasce outra", () => {
    const list = [base({ id: "m", kind: "mensagem", ref: "conversa:g1", readAt: "2026-09-20T10:30:00.000Z" })];
    const { list: out, notification } = mergeNotification(list, input(), "2026-09-20T11:00:00.000Z");
    assert.equal(out.length, 2);
    assert.equal(notification.id, "novo");
    assert.equal(notification.count, 1);
  });

  test("menção nunca se junta — cada uma é uma linha", () => {
    const list = [base({ id: "a", kind: "mencao", ref: "conversa:g1" })];
    const { list: out } = mergeNotification(list, input({ kind: "mencao" }), "2026-09-20T11:00:00.000Z");
    assert.equal(out.length, 2);
  });

  test("conversa de outra pessoa não se mistura", () => {
    const list = [base({ id: "m", kind: "mensagem", ref: "conversa:g1", recipientId: "ana" })];
    const { list: out } = mergeNotification(list, input(), "2026-09-20T11:00:00.000Z");
    assert.equal(out.length, 2);
  });
});

describe("o teto por pessoa", () => {
  test("sai a lida mais velha antes de qualquer não lida", () => {
    const list = [
      base({ id: "n1", createdAt: "2026-09-20T10:00:00.000Z" }),
      base({ id: "l1", createdAt: "2026-09-20T12:00:00.000Z", readAt: "x" }),
      base({ id: "l2", createdAt: "2026-09-20T09:00:00.000Z", readAt: "x" }),
      base({ id: "outra", recipientId: "ana" }),
    ];
    const out = trimPerRecipient(list, 2).map((n) => n.id);
    assert.deepEqual(out.sort(), ["l1", "n1", "outra"].sort());
  });
});

describe("abas, contagem e rótulos", () => {
  test("cada aba mostra o que diz", () => {
    const lida = base({ id: "l", readAt: "x", kind: "atribuicao" });
    const mencao = base({ id: "m" });
    assert.equal(inTab(lida, "nao-lidas"), false);
    assert.equal(inTab(mencao, "nao-lidas"), true);
    assert.equal(inTab(mencao, "mencoes"), true);
    assert.equal(inTab(lida, "atribuicoes"), true);
    assert.equal(inTab(lida, "todas"), true);
    assert.equal(unreadTotal([lida, mencao]), 1);
  });

  test("trecho numa linha, sem marcas de markdown, cortado com reticências", () => {
    assert.equal(excerpt("**Oi**\n\n  @ana   veja"), "Oi @ana veja");
    assert.equal(excerpt("x".repeat(200), 10), `${"x".repeat(9)}…`);
  });

  test("o contador só aparece nas mensagens juntadas", () => {
    assert.equal(countLabel(base({ id: "a", kind: "mensagem", count: 3 })), "3 mensagens novas");
    assert.equal(countLabel(base({ id: "b", kind: "mensagem", count: 1 })), "");
    assert.equal(countLabel(base({ id: "c", kind: "mencao", count: 3 })), "");
  });

  test("blocos por dia, o mais novo primeiro", () => {
    const now = Date.parse("2026-09-21T15:00:00");
    const days = groupNotificationsByDay(
      [
        base({ id: "ontem", createdAt: new Date("2026-09-20T10:00:00").toISOString() }),
        base({ id: "hoje", createdAt: new Date("2026-09-21T10:00:00").toISOString() }),
      ],
      now,
    );
    assert.deepEqual(days.map((d) => d.label), ["HOJE", "ONTEM"]);
    assert.equal(days[0].items[0].id, "hoje");
  });
});

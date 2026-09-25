import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { clampToViewport } from "../src/components/ui/useDraggable";
import { summarize } from "../src/lib/inbox/view";
import { DEFAULT_NOTIFY_PREFS } from "../src/lib/inbox/notifyPrefs";
import { AGENCIA_A } from "./helpers/agency";
import type { Conversation, InboxMember } from "../src/lib/inbox/types";

/*
 * O cartão da chamada arrastado nunca sai da tela, e o resumo da conversa
 * leva a foto de quem aparece no avatar (na mesma ordem das iniciais).
 */

describe("cartão da chamada arrastável", () => {
  const size = { width: 280, height: 60 };
  const tela = { width: 1440, height: 900 };

  test("dentro da tela, fica onde soltou", () => {
    assert.deepEqual(clampToViewport({ x: 300, y: 200 }, size, tela), { x: 300, y: 200 });
  });

  test("passou da borda, volta para dentro com a folga", () => {
    assert.deepEqual(clampToViewport({ x: -50, y: -10 }, size, tela), { x: 8, y: 8 });
    assert.deepEqual(clampToViewport({ x: 5000, y: 5000 }, size, tela), { x: 1440 - 280 - 8, y: 900 - 60 - 8 });
  });

  test("tela menor que o cartão: encosta na folga, sem número negativo", () => {
    assert.deepEqual(clampToViewport({ x: 100, y: 100 }, size, { width: 200, height: 40 }), { x: 8, y: 8 });
  });
});

describe("fotos no resumo da conversa", () => {
  const membro = (id: string, photoUrl: string | null): InboxMember => ({
    id,
    agencyId: AGENCIA_A.agencyId,
    name: id === "felipe" ? "Felipe" : id === "marina" ? "Marina" : "Ana",
    email: `${id}@bb.app`,
    handle: id,
    presence: "disponivel",
    role: "editor",
    status: "ativo",
    lastSeenAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    invite: null,
    joinRequest: false,
    title: "",
    photoUrl,
    notify: DEFAULT_NOTIFY_PREFS,
  });
  const membros = [membro("felipe", "/api/media/f"), membro("marina", "/api/media/m"), membro("ana", null)];
  const conversa = (over: Partial<Conversation>): Conversation => ({
    id: "c",
    agencyId: AGENCIA_A.agencyId,
    kind: "direta",
    name: "",
    memberIds: ["felipe", "marina"],
    messages: [],
    mutedBy: [],
    readAt: {},
    call: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...over,
  });

  test("direta: a foto de quem está do outro lado, não a sua", () => {
    assert.deepEqual(summarize(conversa({}), membros, "felipe").photos, ["/api/media/m"]);
    assert.deepEqual(summarize(conversa({}), membros, "marina").photos, ["/api/media/f"]);
  });

  test("grupo: a marca do grupo sem foto; atrás, a de um membro (ou nada)", () => {
    const g = conversa({ kind: "grupo", name: "Design", memberIds: ["felipe", "ana", "marina"] });
    assert.deepEqual(summarize(g, membros, "felipe").photos, [null, null]);
    const g2 = conversa({ kind: "grupo", name: "Design", memberIds: ["felipe", "marina", "ana"] });
    assert.deepEqual(summarize(g2, membros, "felipe").photos, [null, "/api/media/m"]);
  });
});

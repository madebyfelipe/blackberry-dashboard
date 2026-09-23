import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  canManageTeam,
  isWorking,
  lastSeenLabel,
  matchesMember,
  STATUS_BY_ID,
} from "../src/lib/inbox/users";

/*
 * A régua da tela de Usuários: quem administra, quem trabalha, e o "último
 * acesso" escrito do jeito do export.
 */

const AGORA = new Date("2026-09-22T12:00:00.000Z").getTime();
const antes = (ms: number) => new Date(AGORA - ms).toISOString();
const MIN = 60_000;

describe("lastSeenLabel", () => {
  test("escala do export", () => {
    assert.equal(lastSeenLabel(null, AGORA), "—");
    assert.equal(lastSeenLabel(antes(20_000), AGORA), "agora");
    assert.equal(lastSeenLabel(antes(2 * MIN), AGORA), "há 2 min");
    assert.equal(lastSeenLabel(antes(60 * MIN), AGORA), "há 1 h");
    assert.equal(lastSeenLabel(antes(3 * 24 * 60 * MIN), AGORA), "há 3 dias");
    assert.equal(lastSeenLabel(antes(14 * 24 * 60 * MIN), AGORA), "há 2 sem");
  });

  test("data quebrada não vira NaN na tela", () => {
    assert.equal(lastSeenLabel("ontem", AGORA), "—");
  });
});

describe("quem pode o quê", () => {
  test("Admin e Gerente administram; o resto não", () => {
    assert.equal(canManageTeam({ role: "admin" }), true);
    assert.equal(canManageTeam({ role: "gerente" }), true);
    assert.equal(canManageTeam({ role: "editor" }), false);
    assert.equal(canManageTeam({ role: "financeiro" }), false);
  });

  test("só quem está ativo recebe tarefa e aparece no @", () => {
    assert.equal(isWorking({ status: "ativo" }), true);
    assert.equal(isWorking({ status: "convite" }), false);
    assert.equal(isWorking({ status: "inativo" }), false);
    assert.equal(isWorking({ status: "arquivado" }), false);
  });
});

describe("matchesMember", () => {
  const ana = { name: "Ana Beatriz Ramos", handle: "ana", email: "ana.ramos@blackberry.com" };

  test("acha por nome sem acento, por @ e por e-mail", () => {
    assert.equal(matchesMember(ana, "beatriz"), true);
    assert.equal(matchesMember(ana, "@ana"), true);
    assert.equal(matchesMember(ana, "ramos@"), true);
    assert.equal(matchesMember(ana, "bruno"), false);
  });
});

describe("selo de status", () => {
  test("usa tokens do tema, nunca hex", () => {
    for (const s of Object.values(STATUS_BY_ID)) {
      assert.match(s.bg, /^var\(--color-[a-z0-9-]+\)$/);
      assert.match(s.fg, /^var\(--color-[a-z0-9-]+\)$/);
    }
  });
});

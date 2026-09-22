import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  CALL_MAX_SECONDS,
  CALL_MEMBER_STALE_MS,
  activeCallMembers,
  joinedCall,
  leftCall,
  settleCall,
} from "../src/lib/inbox/call";

const T0 = Date.parse("2026-09-22T10:00:00.000Z");
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("quem está na chamada", () => {
  test("quem entra abre; quem entra de novo só renova o sinal", () => {
    const um = joinedCall(null, "felipe", T0);
    assert.deepEqual(um.memberIds, ["felipe"]);
    assert.equal(um.startedBy, "felipe");
    const dois = joinedCall(um, "marina", T0 + MIN);
    const denovo = joinedCall(dois, "marina", T0 + 2 * MIN);
    assert.deepEqual(denovo.memberIds, ["felipe", "marina"]);
    assert.equal(denovo.seenAt.marina, iso(T0 + 2 * MIN));
    assert.equal(denovo.startedAt, iso(T0), "o início é o da chamada, não o de quem entrou");
  });

  test("dentro da folga continua; passou dela, saiu", () => {
    const call = joinedCall(joinedCall(null, "felipe", T0), "marina", T0);
    assert.deepEqual(activeCallMembers(call, T0 + CALL_MEMBER_STALE_MS), ["felipe", "marina"]);
    const marinaSegue = joinedCall(call, "marina", T0 + 5 * MIN);
    assert.deepEqual(activeCallMembers(marinaSegue, T0 + 6 * MIN), ["marina"]);
  });

  test("chamada longa não expira enquanto há sinal — 10h de chamada é chamada", () => {
    let call = joinedCall(null, "felipe", T0);
    for (let t = T0; t <= T0 + 10 * 60 * MIN; t += MIN / 2) call = joinedCall(call, "felipe", t);
    assert.equal(settleCall(call, T0 + 10 * 60 * MIN).changed, false);
  });

  test("limpeza tira só quem sumiu", () => {
    const call = joinedCall(joinedCall(null, "felipe", T0), "marina", T0 + 10 * MIN);
    const r = settleCall(call, T0 + 11 * MIN);
    assert.deepEqual(r.call!.memberIds, ["marina"]);
    assert.equal(r.ended, undefined);
    assert.equal(r.call!.seenAt.felipe, undefined);
  });

  test("todo mundo sumiu: fecha, com a duração até o último sinal", () => {
    const call = joinedCall(joinedCall(null, "marina", T0), "felipe", T0 + 20 * MIN);
    const r = settleCall(call, T0 + 3 * 60 * MIN);
    assert.equal(r.call, null);
    assert.deepEqual(r.ended, { startedBy: "marina", seconds: 20 * 60 });
  });

  test("gravação sem sinal de vida conta desde o início", () => {
    const antiga = { startedBy: "felipe", startedAt: iso(T0), memberIds: ["felipe"], seenAt: {} };
    assert.deepEqual(activeCallMembers(antiga, T0 + MIN), ["felipe"]);
    assert.equal(settleCall(antiga, T0 + 3 * MIN).call, null);
  });

  test("o último a sair fecha de ponta a ponta, com teto", () => {
    const call = joinedCall(null, "felipe", T0);
    assert.deepEqual(leftCall(call, "felipe", T0 + 12 * MIN).ended, {
      startedBy: "felipe",
      seconds: 12 * 60,
    });
    assert.equal(leftCall(call, "felipe", T0 + 99 * 60 * MIN).ended!.seconds, CALL_MAX_SECONDS);
  });

  test("sair de chamada em que não se está não muda nada", () => {
    const call = joinedCall(null, "felipe", T0);
    assert.equal(leftCall(call, "ana", T0 + MIN).changed, false);
  });
});

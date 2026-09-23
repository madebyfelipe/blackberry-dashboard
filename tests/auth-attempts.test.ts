import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { MAX_ATTEMPTS, WINDOW_MS, attemptKey, createAttempts } from "../src/lib/auth/attempts";

describe("freio de tentativas do login", () => {
  test("bloqueia depois do limite e libera quando a janela passa", () => {
    let t = 0;
    const a = createAttempts(() => t);
    const k = attemptKey("Felipe@BB.app ", "1.2.3.4");
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) a.fail(k);
    assert.equal(a.blockedFor(k), 0);
    a.fail(k);
    assert.ok(a.blockedFor(k) > 0);
    t += WINDOW_MS + 1;
    assert.equal(a.blockedFor(k), 0);
  });

  test("acertar zera a contagem", () => {
    const a = createAttempts(() => 0);
    const k = attemptKey("a@b.co", null);
    for (let i = 0; i < MAX_ATTEMPTS; i++) a.fail(k);
    a.succeed(k);
    assert.equal(a.blockedFor(k), 0);
  });

  test("a chave separa e-mail e IP", () => {
    assert.notEqual(attemptKey("a@b.co", "1.1.1.1"), attemptKey("a@b.co", "2.2.2.2"));
    assert.equal(attemptKey(" A@B.co", "1.1.1.1"), attemptKey("a@b.co", "1.1.1.1"));
  });
});

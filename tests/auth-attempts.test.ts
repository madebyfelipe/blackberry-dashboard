import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { MAX_ATTEMPTS, WINDOW_MS, attemptKey, createAttempts } from "../src/lib/auth/attempts";

describe("freio de tentativas do login", () => {
  test("bloqueia depois do limite e libera quando a janela passa", () => {
    let t = 0;
    const a = createAttempts(() => t);
    const k = attemptKey("Felipe@BB.app ", "1.2.3.4");
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) assert.equal(a.reserve(k), 0);
    assert.equal(a.blockedFor(k), 0);
    assert.equal(a.reserve(k), 0);
    assert.ok(a.blockedFor(k) > 0);
    assert.ok(a.reserve(k) > 0, "bloqueado, a reserva devolve a espera");
    t += WINDOW_MS + 1;
    assert.equal(a.blockedFor(k), 0);
  });

  test("acertar zera a contagem", () => {
    const a = createAttempts(() => 0);
    const k = attemptKey("a@b.co", null);
    for (let i = 0; i < MAX_ATTEMPTS; i++) a.reserve(k);
    a.succeed(k);
    assert.equal(a.blockedFor(k), 0);
  });

  test("release devolve só a vaga reservada", () => {
    const a = createAttempts(() => 0);
    const k = attemptKey("a@b.co", null);
    for (let i = 0; i < MAX_ATTEMPTS; i++) a.reserve(k);
    assert.ok(a.blockedFor(k) > 0);
    a.release(k);
    assert.equal(a.blockedFor(k), 0);
    assert.equal(a.reserve(k), 0);
    assert.ok(a.blockedFor(k) > 0);
    a.release(k); // sem entrada viva, não faz nada nem lança
    a.succeed(k);
    a.release(k);
    assert.equal(a.blockedFor(k), 0);
  });

  test("a chave separa e-mail e IP", () => {
    assert.notEqual(attemptKey("a@b.co", "1.1.1.1"), attemptKey("a@b.co", "2.2.2.2"));
    assert.equal(attemptKey(" A@B.co", "1.1.1.1"), attemptKey("a@b.co", "1.1.1.1"));
  });

  /*
   * O ataque da issue #93, na ordem da rota: reserva → confere a senha
   * (assíncrono) → erro. Com a contagem depois do `await`, as N chegavam
   * todas no `authenticate` antes de qualquer uma contar.
   */
  test("N tentativas em paralelo contam N — só MAX_ATTEMPTS chegam na senha", async () => {
    const a = createAttempts(() => 0);
    const k = attemptKey("felipe@blackberry.app", "6.6.6.6");
    let conferidas = 0;
    const senhaErrada = async () => {
      await new Promise((r) => setTimeout(r, 5));
      conferidas++;
      throw new Error("senha errada");
    };
    const login = async () => {
      if (a.reserve(k) > 0) return 429;
      try {
        await senhaErrada();
        return 200;
      } catch {
        return 401;
      }
    };
    const status = await Promise.all(Array.from({ length: 200 }, login));
    assert.equal(conferidas, MAX_ATTEMPTS);
    assert.equal(status.filter((s) => s === 401).length, MAX_ATTEMPTS);
    assert.equal(status.filter((s) => s === 429).length, 200 - MAX_ATTEMPTS);
  });
});

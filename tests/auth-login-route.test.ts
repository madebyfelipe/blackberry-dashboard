import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Base de contas só deste teste, vazia (ver helpers/data-dir.ts).
usarDataDirTemporario("login-route");
escreverData("users.json", []);

const { registerUser } = await import("../src/lib/auth/repository");
const { MAX_ATTEMPTS } = await import("../src/lib/auth/attempts");
const { POST } = await import("../src/app/api/auth/login/route");

function pedido(email: string, password: string): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
    body: JSON.stringify({ email, password }),
  });
}

/*
 * A rota de verdade (o caminho de senha errada não passa por `next/headers`).
 * O ataque da issue #93: 200 logins disparados juntos contra a mesma conta.
 * Antes, todos conferiam a senha antes de o primeiro erro contar.
 */
describe("POST /api/auth/login — freio sob concorrência", () => {
  test("200 tentativas em paralelo: só MAX_ATTEMPTS testam a senha", async () => {
    const user = await registerUser({
      name: "Felipe",
      email: "alvo@blackberry.app",
      password: "senha-certa-123",
    });
    const respostas = await Promise.all(
      Array.from({ length: 200 }, (_, i) => POST(pedido(user.email, `chute-${i}`))),
    );
    const status = respostas.map((r) => r.status);
    assert.equal(status.filter((s) => s === 401).length, MAX_ATTEMPTS);
    assert.equal(status.filter((s) => s === 429).length, 200 - MAX_ATTEMPTS);

    // Bloqueada, nem a senha certa passa pelo freio.
    const depois = await POST(pedido(user.email, "senha-certa-123"));
    assert.equal(depois.status, 429);
  });
});

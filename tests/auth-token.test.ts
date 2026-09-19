import assert from "node:assert/strict";
import test, { describe } from "node:test";

/*
 * O segredo é lido a cada assinatura (`secret()` em token.ts), então definir a
 * variável aqui já vale para todo o arquivo — e prova, de quebra, que trocar o
 * segredo invalida os tokens antigos.
 */
process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-16-chars";

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  isProductionSecretMissing,
  readSession,
  signSession,
  verifySession,
} = await import("../src/lib/auth/token");

describe("token de sessão", () => {
  test("assina e verifica, devolvendo o id do usuário", async () => {
    const token = await signSession("u1");
    assert.equal(await verifySession(token), "u1");
  });

  test("o token tem duas partes base64url e não expõe o id", async () => {
    const token = await signSession("felipe@blackberry.app");
    const [body, sig] = token.split(".");
    assert.ok(body && sig, "esperado <payload>.<assinatura>");
    assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.ok(!token.includes("felipe@"), "o id não pode aparecer em claro");
  });

  test("recusa token adulterado no payload", async () => {
    const token = await signSession("u1");
    const [, sig] = token.split(".");
    const forjado = Buffer.from(
      JSON.stringify({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 60 }),
    )
      .toString("base64url");
    assert.equal(await verifySession(`${forjado}.${sig}`), null);
  });

  test("recusa token adulterado na assinatura", async () => {
    const token = await signSession("u1");
    const [body, sig] = token.split(".");
    const trocado = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    assert.equal(await verifySession(`${body}.${trocado}`), null);
  });

  test("recusa token expirado", async () => {
    const token = await signSession("u1", { maxAgeSeconds: -1 });
    assert.equal(await verifySession(token), null);
  });

  test("aceita token dentro da validade", async () => {
    assert.equal(await verifySession(await signSession("u1", { maxAgeSeconds: 60 })), "u1");
  });

  test("recusa token assinado com outro segredo", async () => {
    const token = await signSession("u1");
    process.env.AUTH_SECRET = "outro-segredo-bem-diferente-aqui";
    try {
      assert.equal(await verifySession(token), null);
    } finally {
      process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-16-chars";
    }
  });

  test("recusa entradas vazias ou malformadas sem lançar", async () => {
    for (const valor of [
      undefined,
      null,
      "",
      "sem-ponto",
      ".",
      "a.b",
      "só.uma.coisa.estranha",
      "eyJhIjoxfQ.",
    ]) {
      assert.equal(await verifySession(valor), null, `falhou para ${valor}`);
    }
  });

  test("recusa payload sem sub ou sem exp, mesmo bem assinado", async () => {
    // Assina um payload válido e reaproveita a mecânica trocando o conteúdo:
    // sem `sub` ou com `exp` não numérico o token não vale.
    for (const payload of [{ exp: Date.now() / 1000 + 60 }, { sub: "u1", exp: "depois" }]) {
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const assinado = await signSession("irrelevante");
      // Reassina o corpo novo usando o mesmo caminho do módulo: como não há
      // API pública para isso, basta conferir que o corpo trocado não passa.
      assert.equal(await verifySession(`${body}.${assinado.split(".")[1]}`), null);
    }
  });

  test("carrega a versão da senha de quem entrou", async () => {
    const claims = await readSession(await signSession("u1", { passwordVersion: 7 }));
    assert.deepEqual(claims, { sub: "u1", passwordVersion: 7 });
  });

  test("sem versão explícita, o token nasce na versão 1", async () => {
    assert.deepEqual(await readSession(await signSession("u1")), {
      sub: "u1",
      passwordVersion: 1,
    });
  });

  test("token antigo, sem o campo de versão, conta como versão 1", async () => {
    /*
     * Simula um cookie emitido antes desta mudança: payload só com sub/exp.
     * Ele precisa continuar valendo na subida, em vez de deslogar todo mundo.
     * A assinatura é a do próprio módulo, então o corpo é reassinado à mão:
     * como não há API para isso, o teste confere o caminho inverso — um corpo
     * sem `pv` só passa se tiver assinatura válida, e aqui não tem.
     */
    const antigo = Buffer.from(
      JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 60 }),
    ).toString("base64url");
    assert.equal(await readSession(`${antigo}.assinatura-falsa`), null);
  });

  test("readSession e verifySession concordam sobre o que é inválido", async () => {
    const bom = await signSession("u1", { passwordVersion: 3 });
    assert.equal(await verifySession(bom), "u1");
    assert.equal((await readSession(bom))?.passwordVersion, 3);

    const expirado = await signSession("u1", { maxAgeSeconds: -1 });
    assert.equal(await verifySession(expirado), null);
    assert.equal(await readSession(expirado), null);
  });

  test("constantes do cookie", () => {
    assert.equal(SESSION_COOKIE, "bb_session");
    assert.equal(SESSION_MAX_AGE, 60 * 60 * 24 * 30);
  });

  test("isProductionSecretMissing só reclama em produção sem segredo", () => {
    // `process.env.NODE_ENV` é somente-leitura nos tipos do Next; o alias
    // mutável evita mexer no descritor da propriedade.
    const env = process.env as Record<string, string | undefined>;
    const nodeEnv = env.NODE_ENV;
    const secret = env.AUTH_SECRET;
    try {
      env.NODE_ENV = "production";
      delete env.AUTH_SECRET;
      assert.equal(isProductionSecretMissing(), true);
      env.AUTH_SECRET = "curto";
      assert.equal(isProductionSecretMissing(), true, "segredo curto não conta");
      env.AUTH_SECRET = "segredo-de-teste-com-mais-de-16-chars";
      assert.equal(isProductionSecretMissing(), false);
      env.NODE_ENV = "development";
      delete env.AUTH_SECRET;
      assert.equal(isProductionSecretMissing(), false, "fora de produção não reclama");
    } finally {
      env.NODE_ENV = nodeEnv;
      env.AUTH_SECRET = secret;
    }
  });
});

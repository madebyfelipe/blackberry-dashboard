import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  SCRYPT_N,
  SCRYPT_P,
  SCRYPT_R,
  hashPassword,
  hashPasswordSync,
  needsRehash,
  verifyDecoyPassword,
  verifyPassword,
} from "../src/lib/auth/password";

describe("senha (scrypt)", () => {
  test("hash tem o formato gravado no arquivo, com o custo explícito (issue #110)", async () => {
    const stored = await hashPassword("blackberry");
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    assert.equal(scheme, "scrypt2");
    assert.equal(Number(n), SCRYPT_N);
    assert.equal(Number(r), SCRYPT_R);
    assert.equal(Number(p), SCRYPT_P);
    assert.match(salt, /^[0-9a-f]{32}$/, "salt de 16 bytes em hex");
    assert.match(hash, /^[0-9a-f]{128}$/, "hash de 64 bytes em hex");
  });

  test("a senha certa verifica", async () => {
    const stored = await hashPassword("blackberry");
    assert.equal(await verifyPassword("blackberry", stored), true);
  });

  test("a senha errada não verifica", async () => {
    const stored = await hashPassword("blackberry");
    for (const errada of ["blackberr", "blackberry ", "Blackberry", "", "outra"]) {
      assert.equal(
        await verifyPassword(errada, stored),
        false,
        `"${errada}" não devia entrar`,
      );
    }
  });

  test("o salt é por senha: dois hashes da mesma senha são diferentes", async () => {
    const a = await hashPassword("blackberry");
    const b = await hashPassword("blackberry");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("blackberry", a), true);
    assert.equal(await verifyPassword("blackberry", b), true);
  });

  test("hashPasswordSync (seed) produz hash que a verificação assíncrona aceita", async () => {
    const stored = hashPasswordSync("blackberry");
    assert.equal(await verifyPassword("blackberry", stored), true);
    assert.equal(await verifyPassword("errada", stored), false);
  });

  test("acentos e unicode sobrevivem à ida e volta", async () => {
    const senha = "çãoúnico-🔒-senha";
    assert.equal(await verifyPassword(senha, await hashPassword(senha)), true);
  });

  test("registro malformado nunca vira login válido", async () => {
    const malformados = [
      "",
      "qualquer-coisa",
      "md5$aa$bb",
      "scrypt$$",
      "scrypt$aa$",
      "scrypt$$bb",
      // A borda perigosa: parte hex ilegível vira Buffer vazio, e uma
      // comparação de zero bytes daria "igual" para qualquer senha.
      "scrypt$aa$zz",
      "scrypt$zz$aa",
      "scrypt2$aa$8$5$00$00",
      "scrypt2$16384$8$5$$",
    ];
    for (const stored of malformados) {
      assert.equal(
        await verifyPassword("qualquer", stored),
        false,
        `"${stored}" não pode aprovar senha nenhuma`,
      );
    }
  });

  /*
   * Issue #110: o formato antigo ("scrypt$salt$hash", custo implícito do
   * padrão do Node) não pode parar de entrar quando a conta sobe de custo —
   * `authenticate`, em `repository.ts`, é quem regrava depois de conferir.
   */
  describe("formato antigo — senha gravada antes da issue #110", () => {
    test("continua verificando", async () => {
      const { scryptSync } = await import("node:crypto");
      const salt = Buffer.from("11112222333344445555666677778888", "hex");
      const hash = scryptSync("senha-antiga", salt, 64).toString("hex");
      const antigo = `scrypt$${salt.toString("hex")}$${hash}`;
      assert.equal(await verifyPassword("senha-antiga", antigo), true);
      assert.equal(await verifyPassword("outra", antigo), false);
    });
  });

  describe("needsRehash", () => {
    test("formato antigo precisa regravar", () => {
      assert.equal(needsRehash("scrypt$aa$bb"), true);
    });

    test("formato novo, no custo atual, não precisa", async () => {
      assert.equal(needsRehash(await hashPassword("blackberry")), false);
    });

    test("formato novo com custo diferente do atual ainda precisa", () => {
      assert.equal(needsRehash(`scrypt2$1$1$1$${"aa".repeat(16)}$${"bb".repeat(64)}`), true);
    });

    test("lixo qualquer precisa (nunca aprova sem reconferir)", () => {
      assert.equal(needsRehash(""), true);
      assert.equal(needsRehash("md5$aa$bb"), true);
    });
  });

  test("verifyDecoyPassword nunca lança, qualquer senha", async () => {
    await verifyDecoyPassword("qualquer coisa");
    await verifyDecoyPassword("");
  });
});

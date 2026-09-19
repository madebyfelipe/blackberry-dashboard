import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
} from "../src/lib/auth/password";

describe("senha (scrypt)", () => {
  test("hash tem o formato gravado no arquivo", async () => {
    const stored = await hashPassword("blackberry");
    const [scheme, salt, hash] = stored.split("$");
    assert.equal(scheme, "scrypt");
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
    ];
    for (const stored of malformados) {
      assert.equal(
        await verifyPassword("qualquer", stored),
        false,
        `"${stored}" não pode aprovar senha nenhuma`,
      );
    }
  });
});

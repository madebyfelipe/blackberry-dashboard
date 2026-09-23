import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  handleProblem,
  mentionsIn,
  normalizeHandle,
  suggestHandle,
} from "@/lib/inbox/handle";

/*
 * O @ de cada pessoa: é o que a menção e a atribuição usam, então precisa
 * sair do nome de um jeito previsível e nunca repetir dentro da agência.
 */

describe("normalizeHandle", () => {
  test("tira @, acento, maiúscula e espaço", () => {
    assert.equal(normalizeHandle("@Fêlipe"), "felipe");
    assert.equal(normalizeHandle("Rodrigo Q."), "rodrigo.q");
    assert.equal(normalizeHandle("  Ana__Luiza  "), "ana.luiza");
  });

  test("não deixa ponto nas pontas", () => {
    assert.equal(normalizeHandle(".marina."), "marina");
  });
});

describe("handleProblem", () => {
  test("aceita o formato do produto", () => {
    assert.equal(handleProblem("felipe"), null);
    assert.equal(handleProblem("ana.l"), null);
    assert.equal(handleProblem("pedro_2"), null);
  });

  test("recusa curto, longo e caractere fora", () => {
    assert.ok(handleProblem("a"));
    assert.ok(handleProblem("a".repeat(25)));
    assert.ok(handleProblem("ana-luiza"));
    assert.ok(handleProblem(".ana"));
  });
});

describe("suggestHandle", () => {
  test("primeiro nome quando está livre", () => {
    assert.equal(suggestHandle("Marina Duarte", []), "marina");
  });

  test("com o primeiro em uso, entra o sobrenome", () => {
    assert.equal(suggestHandle("Rodrigo Q.", ["rodrigo"]), "rodrigo.q");
  });

  test("esgotadas as formas, número no fim", () => {
    assert.equal(suggestHandle("Ana", ["ana"]), "ana2");
    assert.equal(suggestHandle("Ana", ["ana", "ana2"]), "ana3");
  });

  test("nome que não rende @ vira pessoa", () => {
    assert.equal(suggestHandle("—", []), "pessoa");
  });
});

describe("mentionsIn", () => {
  test("acha as menções, sem repetir", () => {
    assert.deepEqual(mentionsIn("@marina olha isso, @ana e @marina"), ["marina", "ana"]);
  });

  test("e-mail não é menção", () => {
    assert.deepEqual(mentionsIn("manda para ana@studio.com"), []);
  });

  test("pontuação depois do @ não entra", () => {
    assert.deepEqual(mentionsIn("valeu @rodrigo.q."), ["rodrigo.q"]);
  });
});

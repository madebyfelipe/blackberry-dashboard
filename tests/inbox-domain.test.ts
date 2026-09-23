import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { domainProblem, emailDomain, normalizeDomain } from "../src/lib/inbox/domain";

/*
 * O domínio da agência decide quem ganha convite automático — um domínio
 * aceito errado abre a agência para qualquer um.
 */

describe("normalizeDomain", () => {
  test("tira @, espaço e maiúscula", () => {
    assert.equal(normalizeDomain(" @EstudioNorte.com "), "estudionorte.com");
    assert.equal(normalizeDomain("ana@estudionorte.com.br"), "estudionorte.com.br");
  });

  test("o que não é domínio vira vazio", () => {
    assert.equal(normalizeDomain("estudio norte"), "");
    assert.equal(normalizeDomain("localhost"), "");
  });
});

describe("emailDomain", () => {
  test("pega a parte depois do último @", () => {
    assert.equal(emailDomain("Felipe@BlackBerry.app"), "blackberry.app");
    assert.equal(emailDomain("sem-arroba"), "");
  });
});

describe("domainProblem", () => {
  test("aceita o domínio do próprio e-mail", () => {
    assert.equal(domainProblem("blackberry.app", "felipe@blackberry.app"), null);
  });

  test("recusa e-mail pessoal, mesmo sendo o seu", () => {
    assert.ok(domainProblem("gmail.com", "felipe@gmail.com"));
  });

  test("recusa domínio que não é o seu", () => {
    assert.ok(domainProblem("outraagencia.com", "felipe@blackberry.app"));
  });

  test("recusa vazio", () => {
    assert.ok(domainProblem("", "felipe@blackberry.app"));
  });
});

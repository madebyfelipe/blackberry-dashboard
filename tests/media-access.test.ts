import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { agencyIdFromName } from "../src/lib/agency/id";
import { mediaAccess } from "../src/lib/media/access";

/*
 * Issue #111: contrato da ficha e anexo de conversa não podem sair de
 * `GET /api/media/<id>` sem sessão — mas a arte do lote, a foto de perfil e
 * o logo da agência precisam continuar públicos (link de aprovação do
 * cliente). `mediaAccess` é a régua pura que a rota aplica.
 */
describe("mediaAccess", () => {
  const AG_A = agencyIdFromName("Agência A");
  const AG_B = agencyIdFromName("Agência B");

  test("sem agencyId no registro, é pública — com ou sem sessão", () => {
    assert.equal(mediaAccess({ agencyId: undefined }, undefined), "ok");
    assert.equal(mediaAccess({ agencyId: undefined }, AG_A), "ok");
  });

  test("com agencyId, sem sessão: recusa (401)", () => {
    assert.equal(mediaAccess({ agencyId: AG_A }, undefined), "sem-sessao");
  });

  test("com agencyId, sessão de outra agência: trata como inexistente (404)", () => {
    assert.equal(mediaAccess({ agencyId: AG_A }, AG_B), "outra-agencia");
  });

  test("com agencyId, sessão da mesma agência: ok", () => {
    assert.equal(mediaAccess({ agencyId: AG_A }, AG_A), "ok");
  });
});

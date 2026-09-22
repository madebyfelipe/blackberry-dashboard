import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import {
  callRoom,
  capabilityFor,
  conversationChannel,
  presenceChannel,
} from "../src/lib/realtime/channels";

/*
 * A régua do tempo real é uma régua de acesso: o token que o navegador
 * recebe carrega exatamente estas permissões. Um curinga a mais aqui deixa
 * alguém ouvir a conversa dos outros sem nenhum erro aparecer na tela — é o
 * tipo de falha que só um teste pega.
 */

describe("nomes de canal", () => {
  test("toda separação começa pela agência", () => {
    assert.notEqual(
      conversationChannel(AGENCIA_A.agencyId, "c1"),
      conversationChannel(AGENCIA_B.agencyId, "c1"),
      "mesma conversa, agências diferentes: canais diferentes",
    );
    assert.notEqual(
      presenceChannel(AGENCIA_A.agencyId),
      presenceChannel(AGENCIA_B.agencyId),
    );
    assert.notEqual(
      callRoom(AGENCIA_A.agencyId, "c1"),
      callRoom(AGENCIA_B.agencyId, "c1"),
      "duas agências não podem cair na mesma sala de chamada",
    );
  });

  test("o nome é estável: quem entra depois cai no mesmo lugar", () => {
    assert.equal(
      callRoom(AGENCIA_A.agencyId, "g-monte"),
      callRoom(AGENCIA_A.agencyId, "g-monte"),
    );
  });
});

describe("permissão do token", () => {
  const cap = capabilityFor(AGENCIA_A.agencyId, ["c1", "c2"]);

  test("só as conversas passadas entram — nada de curinga", () => {
    const canais = Object.keys(cap);
    assert.equal(
      canais.some((c) => c.includes("*")),
      false,
      "curinga deixaria ouvir conversa de que a pessoa não participa",
    );
    assert.ok(cap[conversationChannel(AGENCIA_A.agencyId, "c1")]);
    assert.ok(cap[conversationChannel(AGENCIA_A.agencyId, "c2")]);
    assert.equal(cap[conversationChannel(AGENCIA_A.agencyId, "c3")], undefined);
  });

  test("no canal da conversa ninguém publica — quem publica é o servidor", () => {
    for (const [canal, ops] of Object.entries(cap)) {
      if (canal.includes(":conversa:")) {
        assert.deepEqual(ops, ["subscribe"], `${canal} devia ser só leitura`);
      }
    }
  });

  test("presença é o único lugar em que o navegador escreve — e escreve sobre si", () => {
    assert.deepEqual(cap[presenceChannel(AGENCIA_A.agencyId)], [
      "subscribe",
      "presence",
    ]);
  });

  test("nenhuma permissão alcança outra agência", () => {
    for (const canal of Object.keys(cap)) {
      assert.ok(
        canal.startsWith(`bb:${AGENCIA_A.agencyId}:`),
        `${canal} escapou do prefixo da agência`,
      );
    }
  });

  test("sem conversa nenhuma, sobra só a presença", () => {
    assert.deepEqual(Object.keys(capabilityFor(AGENCIA_A.agencyId, [])), [
      presenceChannel(AGENCIA_A.agencyId),
    ]);
  });
});

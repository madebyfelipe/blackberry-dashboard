import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";
import { callRoom } from "../src/lib/realtime/channels";
import {
  ABLY_TOKEN_TTL_MS,
  LIVEKIT_TOKEN_TTL,
  revokeMember,
  type AblyRevoker,
  type LivekitRooms,
} from "../src/lib/realtime/revoke";

/*
 * Arquivar tira a pessoa do tempo real na hora (issue #94): o token do Ably
 * é revogado pelo `clientId` e ela sai de toda sala aberta das conversas
 * dela. Os clientes aqui são de mentira — registram o que foi pedido.
 */

const A = AGENCIA_A.agencyId;

function fakeAbly(opts: { falha?: string; recusa?: string } = {}) {
  const pedidos: { type: string; value: string }[][] = [];
  const ably: AblyRevoker = {
    async revokeTokens(specs) {
      pedidos.push(specs);
      if (opts.falha) throw new Error(opts.falha);
      if (opts.recusa) {
        return { successCount: 0, failureCount: 1, results: [{ error: { message: opts.recusa } }] };
      }
      return { successCount: 1, failureCount: 0, results: [{}] };
    },
  };
  return { ably, pedidos };
}

function fakeLivekit(salas: Record<string, string[]>) {
  const removidos: [string, string][] = [];
  const livekit: LivekitRooms = {
    async listRooms(names) {
      return Object.keys(salas)
        .filter((n) => !names || names.includes(n))
        .map((name) => ({ name }));
    },
    async removeParticipant(room, identity) {
      if (!salas[room]?.includes(identity)) throw new Error("participant not found");
      removidos.push([room, identity]);
    },
  };
  return { livekit, removidos };
}

describe("revogar ao arquivar", () => {
  test("revoga o token do Ably pelo id do membro", async () => {
    const { ably, pedidos } = fakeAbly();
    const r = await revokeMember({ ably }, A, "m-ana", ["g1"]);
    assert.deepEqual(pedidos, [[{ type: "clientId", value: "m-ana" }]]);
    assert.equal(r.ably, true);
    assert.deepEqual(r.errors, []);
  });

  test("tira a pessoa das salas abertas das conversas dela — e só delas", async () => {
    const { livekit, removidos } = fakeLivekit({
      [callRoom(A, "g1")]: ["m-ana", "m-bia"],
      [callRoom(A, "g2")]: ["m-bia"],
      // Sala de uma conversa que não é dela: nem é consultada.
      [callRoom(A, "g-alheio")]: ["m-ana"],
    });
    const r = await revokeMember({ livekit }, A, "m-ana", ["g1", "g2", "g3"]);
    assert.deepEqual(removidos, [[callRoom(A, "g1"), "m-ana"]]);
    assert.deepEqual(r.rooms, [callRoom(A, "g1")]);
    assert.deepEqual(r.errors, []);
  });

  test("falha do Ably não impede tirar da chamada, e vai para o log", async () => {
    const { ably } = fakeAbly({ falha: "token revocation not enabled" });
    const { livekit, removidos } = fakeLivekit({ [callRoom(A, "g1")]: ["m-ana"] });
    const r = await revokeMember({ ably, livekit }, A, "m-ana", ["g1"]);
    assert.equal(r.ably, false);
    assert.equal(removidos.length, 1);
    assert.match(r.errors.join(), /ably: token revocation not enabled/);
  });

  test("revogação recusada pelo Ably conta como falha", async () => {
    const { ably } = fakeAbly({ recusa: "revocable tokens disabled" });
    const r = await revokeMember({ ably }, A, "m-ana", []);
    assert.equal(r.ably, false);
    assert.match(r.errors.join(), /revocable tokens disabled/);
  });

  test("sem Ably e sem LiveKit configurados não faz nada nem lança", async () => {
    const r = await revokeMember({}, A, "m-ana", ["g1"]);
    assert.deepEqual(r, { ably: false, rooms: [], errors: [] });
  });
});

describe("crachás curtos", () => {
  test("o token do Ably vale no máximo 15 min", () => {
    assert.ok(ABLY_TOKEN_TTL_MS > 0 && ABLY_TOKEN_TTL_MS <= 15 * 60_000);
  });

  test("o crachá do LiveKit também", () => {
    const m = /^(\d+)m$/.exec(LIVEKIT_TOKEN_TTL);
    assert.ok(m, LIVEKIT_TOKEN_TTL);
    assert.ok(Number(m[1]) <= 15);
  });
});

describe("e sem crachá novo", () => {
  test("arquivado não passa da sessão — nem o token do Ably nem o da chamada se renovam", async () => {
    usarDataDirTemporario("revogar");
    const { ensureMember, memberAccess, updateMember } = await import("../src/lib/inbox/repository");
    const dona = await ensureMember(AGENCIA_A, { name: "Dona", email: "dona@a.com" });
    const ana = await ensureMember(AGENCIA_A, { name: "Ana", email: "ana@a.com" });
    assert.equal(await memberAccess(A, "ana@a.com"), "ok");
    await updateMember(AGENCIA_A, dona.id, ana.id, { status: "arquivado" });
    // `/api/realtime/token` e a entrada na chamada passam por `requireAgency`.
    assert.equal(await memberAccess(A, "ana@a.com"), "bloqueado");
  });
});

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escopo } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

/*
 * Issue #111: o id do membro só ganhava um sufixo aleatório quando o slug do
 * e-mail já existia em **qualquer** agência — e o id de volta (com ou sem
 * sufixo) dizia se aquele e-mail já era membro em outra conta. Agora todo
 * membro novo nasce com sufixo, sempre, para o formato não vazar nada.
 */
usarDataDirTemporario("inbox-member-id");

const { ensureMember, inviteMember, requestJoin } = await import("../src/lib/inbox/repository");

const AGENCIA_A = escopo("Agência A — id de membro");
const AGENCIA_B = escopo("Agência B — id de membro");
const AGENCIA_C = escopo("Agência C — id de membro");

const SUFIXO = /^m-[a-z0-9-]*[a-z0-9]-[0-9a-z]{3}$/;

describe("id de membro — sem oráculo de e-mail entre agências", () => {
  test("o mesmo e-mail em duas agências sempre leva sufixo, nas duas", async () => {
    const a = await ensureMember(AGENCIA_A, { name: "Duplicado", email: "duplicado@fora.com" });
    const b = await ensureMember(AGENCIA_B, { name: "Duplicado", email: "duplicado@fora.com" });
    assert.match(a.id, SUFIXO, "primeira agência também devia ganhar sufixo");
    assert.match(b.id, SUFIXO, "segunda agência devia ganhar sufixo (como sempre ganhou)");
    assert.notEqual(a.id, b.id);
  });

  test("inviteMember também sempre sufixa", async () => {
    const admin = await ensureMember(AGENCIA_C, { name: "Admin", email: "admin@c.com" });
    const convite = await inviteMember(AGENCIA_C, admin.id, {
      name: "Convidado",
      email: "convidado@fora.com",
      role: "editor",
    });
    assert.match(convite.id, SUFIXO);
  });

  test("requestJoin (pedido de entrada pelo domínio) também sempre sufixa", async () => {
    const pedido = await requestJoin(AGENCIA_B.agencyId, {
      name: "Pedinte",
      email: "pedinte@fora.com",
    });
    assert.match(pedido.id, SUFIXO);
  });
});

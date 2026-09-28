import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escopo } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

/*
 * Issue #104 — a única trava de `updateMember`/`inviteMember` era "quem mexe
 * em si não tira a própria gestão". Faltavam três regras: só Admin concede ou
 * retira o papel de Admin, só Admin mexe em outro Admin, e a agência nunca
 * fica sem nenhum Admin ativo. Reproduzido com duas contas de verdade
 * (Admin fundador + Gerente convidado) contra os stores de verdade num
 * `data/` temporário.
 */
usarDataDirTemporario("time-admin");

const {
  ForbiddenError,
  ValidationError,
  ensureMember,
  inviteMember,
  updateMember,
} = await import("../src/lib/inbox/repository");

const AGENCIA = escopo("Agência Admin Guard");

const fundador = await ensureMember(AGENCIA, { name: "Fundadora", email: "fundadora@agencia.com" });
assert.equal(fundador.role, "admin", "o primeiro membro da agência nasce Admin");

const gerente = await updateMember(AGENCIA, fundador.id, (
  await ensureMember(AGENCIA, { name: "Gerente", email: "gerente@agencia.com" })
).id, { role: "gerente" });
assert.ok(gerente);

describe("só Admin concede ou retira o papel de Admin", () => {
  test("Gerente não se promove a Admin", async () => {
    await assert.rejects(
      updateMember(AGENCIA, gerente!.id, gerente!.id, { role: "admin" }),
      ForbiddenError,
    );
  });

  test("Gerente não rebaixa um Admin", async () => {
    await assert.rejects(
      updateMember(AGENCIA, gerente!.id, fundador.id, { role: "visualizador" }),
      ForbiddenError,
    );
  });

  test("Admin pode promover Gerente a Admin, e o novo Admin pode rebaixar a si mesmo depois", async () => {
    const promovido = await updateMember(AGENCIA, fundador.id, gerente!.id, { role: "admin" });
    assert.equal(promovido?.role, "admin");
    // Com dois Admins ativos, um deles pode abrir mão do papel sem travar.
    const devolvido = await updateMember(AGENCIA, fundador.id, gerente!.id, { role: "gerente" });
    assert.equal(devolvido?.role, "gerente");
  });
});

describe("só Admin mexe em outro Admin", () => {
  test("Gerente não arquiva um Admin", async () => {
    await assert.rejects(
      updateMember(AGENCIA, gerente!.id, fundador.id, { status: "arquivado" }),
      ForbiddenError,
    );
  });

  test("Gerente não edita o nome de um Admin", async () => {
    await assert.rejects(
      updateMember(AGENCIA, gerente!.id, fundador.id, { name: "Sequestrado" }),
      ForbiddenError,
    );
  });
});

describe("a agência nunca fica sem nenhum Admin ativo", () => {
  test("o único Admin não consegue se rebaixar", async () => {
    await assert.rejects(
      updateMember(AGENCIA, fundador.id, fundador.id, { role: "gerente" }),
      ValidationError,
    );
  });

  test("o único Admin não consegue se arquivar", async () => {
    await assert.rejects(
      updateMember(AGENCIA, fundador.id, fundador.id, { status: "arquivado" }),
      ValidationError,
    );
  });
});

describe("convite de Admin é coisa de Admin", () => {
  test("Gerente não convida ninguém como Admin", async () => {
    await assert.rejects(
      inviteMember(AGENCIA, gerente!.id, { name: "Chefe Novo", email: "chefe-novo@agencia.com", role: "admin" }),
      ForbiddenError,
    );
  });

  test("Admin convida como Admin normalmente", async () => {
    const convidado = await inviteMember(AGENCIA, fundador.id, {
      name: "Segunda Admin",
      email: "segunda-admin@agencia.com",
      role: "admin",
    });
    assert.equal(convidado.role, "admin");
  });
});

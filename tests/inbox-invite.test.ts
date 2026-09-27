import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escopo } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

/*
 * O convite pendente só vira gente pelo link (issue #72). Três caminhos
 * deixavam outra pessoa tomar o convite — inclusive um convite de Admin:
 *
 * 1. o token vazava para qualquer membro pelo Inbox;
 * 2. o cadastro pelo domínio, com o e-mail do convite, ativava o convite sem
 *    o token;
 * 3. excluir o convite de quem já tinha conta deixava a conta entrar como
 *    Editor ativo.
 *
 * Contra os stores de verdade num `data/` temporário.
 */
usarDataDirTemporario("convite");

const {
  ValidationError,
  acceptInvite,
  createGroup,
  deleteMember,
  domainJoinProblem,
  ensureMember,
  findInvite,
  getConversation,
  inviteMember,
  listMembers,
  memberAccess,
  openDirect,
  requestJoin,
} = await import("../src/lib/inbox/repository");
const { publicMember } = await import("../src/lib/inbox/view");

const AGENCIA = escopo("Agência Convite");
const VAZIA = escopo("Agência Vazia");

const dona = await ensureMember(AGENCIA, { name: "Dona", email: "dona@agencia.com" });
const colega = await ensureMember(AGENCIA, { name: "Colega", email: "colega@agencia.com" });
const outra = await ensureMember(AGENCIA, { name: "Outra", email: "outra@agencia.com" });

/** Um convite novo, de Admin — o pior caso da issue. */
async function conviteDeAdmin(email: string) {
  const m = await inviteMember(AGENCIA, dona.id, { name: "Chefe", email, role: "admin" });
  return { member: m, token: m.invite!.token };
}

describe("caminho 1 — o token não sai de Usuários", () => {
  test("o membro público não traz convite, pedido, e-mail nem avisos", async () => {
    const { member } = await conviteDeAdmin("chefe1@x.com");
    const pub = publicMember(member) as Record<string, unknown>;
    for (const k of ["invite", "joinRequest", "email", "notify"]) assert.equal(k in pub, false, k);
    assert.equal(pub.name, "Chefe");
    assert.equal(pub.status, "convite");
    assert.ok(!JSON.stringify(pub).includes(member.invite!.token));
  });

  test("a conversa aberta devolve os membros sem o convite", async () => {
    const direta = await openDirect(AGENCIA, dona.id, colega.id);
    assert.ok(direta);
    const conversa = await getConversation(AGENCIA, dona.id, direta.id);
    for (const m of conversa!.members) {
      const raw = m as Record<string, unknown>;
      assert.equal("invite" in raw, false);
      assert.equal("email" in raw, false);
    }
  });

  test("convidado não entra em conversa nova (direta, grupo)", async () => {
    const { member } = await conviteDeAdmin("chefe2@x.com");
    await assert.rejects(openDirect(AGENCIA, dona.id, member.id), ValidationError);
    await assert.rejects(createGroup(AGENCIA, dona.id, [colega.id, member.id]), ValidationError);
  });
});

describe("caminho 2 — o domínio não ativa convite", () => {
  test("o cadastro pelo domínio com o e-mail de um convite é recusado antes da conta", async () => {
    await conviteDeAdmin("chefe3@agencia.com");
    assert.ok(await domainJoinProblem(AGENCIA.agencyId, "Chefe3@Agencia.com"));
    assert.equal(await domainJoinProblem(AGENCIA.agencyId, "novo@agencia.com"), null);
  });

  test("e, se a conta nascer mesmo assim, o pedido não vira o convite", async () => {
    const { member } = await conviteDeAdmin("chefe4@agencia.com");
    await assert.rejects(
      requestJoin(AGENCIA.agencyId, { name: "Intruso", email: "chefe4@agencia.com" }),
      ValidationError,
    );
    // A primeira entrada da conta não aceita o convite: ela fica barrada…
    assert.equal(await memberAccess(AGENCIA.agencyId, "chefe4@agencia.com"), "bloqueado");
    await ensureMember(AGENCIA, { name: "Intruso", email: "chefe4@agencia.com" });
    const depois = (await listMembers(AGENCIA)).find((m) => m.id === member.id)!;
    // …e o convite continua convite, com o token de pé para a pessoa certa.
    assert.equal(depois.status, "convite");
    assert.equal(depois.invite?.token, member.invite!.token);
  });

  test("pedido pelo domínio de verdade continua esperando aprovação", async () => {
    const pedido = await requestJoin(AGENCIA.agencyId, { name: "Nova", email: "nova@agencia.com" });
    assert.equal(pedido.joinRequest, true);
    assert.equal(await memberAccess(AGENCIA.agencyId, "nova@agencia.com"), "aguardando");
  });
});

describe("o aceite é o cadastro pelo link", () => {
  test("token + e-mail convidado: ativo, com a função do convite, e o token morre", async () => {
    const { member, token } = await conviteDeAdmin("chefe5@x.com");
    assert.equal(await memberAccess(AGENCIA.agencyId, "chefe5@x.com"), "bloqueado");
    const aceito = await acceptInvite(token, "Chefe5@x.com");
    assert.equal(aceito?.id, member.id);
    assert.equal(aceito?.status, "ativo");
    assert.equal(aceito?.role, "admin");
    assert.equal(aceito?.invite, null);
    assert.equal(await findInvite(token), undefined);
    assert.equal(await memberAccess(AGENCIA.agencyId, "chefe5@x.com"), "ok");
  });

  test("token com outro e-mail não aceita nada", async () => {
    const { member, token } = await conviteDeAdmin("chefe6@x.com");
    assert.equal(await acceptInvite(token, "visualizador@agencia.com"), undefined);
    assert.equal((await listMembers(AGENCIA)).find((m) => m.id === member.id)?.status, "convite");
  });
});

describe("caminho 3 — excluir o convite revoga", () => {
  test("a conta de um convite excluído não entra", async () => {
    const { member } = await conviteDeAdmin("chefe7@x.com");
    assert.equal(await deleteMember(AGENCIA, dona.id, member.id), true);
    assert.equal(await memberAccess(AGENCIA.agencyId, "chefe7@x.com"), "bloqueado");
  });

  test("conta sem membro numa agência com gente não entra; o fundador, sim", async () => {
    assert.equal(await memberAccess(AGENCIA.agencyId, "ninguem@agencia.com"), "bloqueado");
    assert.equal(await memberAccess(VAZIA.agencyId, "fundador@vazia.com"), "ok");
    const fundador = await ensureMember(VAZIA, { name: "Fundador", email: "fundador@vazia.com" });
    assert.equal(fundador.role, "admin");
  });

  test("quem já é do time continua entrando", async () => {
    assert.equal(await memberAccess(AGENCIA.agencyId, "outra@agencia.com"), "ok");
    assert.equal(outra.status, "ativo");
  });
});

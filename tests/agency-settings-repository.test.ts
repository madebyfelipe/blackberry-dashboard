import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

/*
 * As gravações das Configurações, contra os stores de verdade num `data/`
 * temporário: perfil do membro, renomear a agência, sair de todos os
 * aparelhos, os ajustes da agência — e "Excluir agência", que tem de levar
 * tudo da A sem encostar num fio da B.
 */
usarDataDirTemporario("configuracoes");

const { registerUser, renameAgency, revokeSessions, getPasswordVersion, listUsers } = await import(
  "../src/lib/auth/repository"
);
const { ensureMember, updateMyProfile, listMembers, ValidationError, createGroup } = await import(
  "../src/lib/inbox/repository"
);
const { read: readInbox } = await import("../src/lib/inbox/store");
const { getAgencySettings, updateAgencySettings, AgencySettingsError } = await import(
  "../src/lib/agency/repository"
);
const { createTask, listTasks } = await import("../src/lib/tasks/repository");
const { createClient, listClients } = await import("../src/lib/clients/repository");
const { updateContract, listAccounts } = await import("../src/lib/crm/repository");
const { createFlow, listFlows } = await import("../src/lib/flows/repository");
const { pushNotifications, listNotifications } = await import("../src/lib/notifications/repository");
const { deleteAgency } = await import("../src/lib/agency/delete");

async function agencia(scope: typeof AGENCIA_A, email: string, colega: string) {
  await registerUser({ name: "Dona", email, password: "senha-boa-1", joinAgency: scope });
  const me = await ensureMember(scope, { name: "Dona", email });
  const outro = await ensureMember(scope, { name: "Colega", email: colega });
  const terceiro = await ensureMember(scope, { name: "Terceira", email: "3-" + colega });
  const client = await createClient(scope, { name: `Cliente ${scope.agencyName}` });
  await updateContract(scope, client.id, { contract: { cycle: "anual" } });
  await createTask(scope, { title: "Tarefa", client: client.name });
  await createFlow(scope, { name: "Fluxo" } as never);
  await pushNotifications(scope, [
    { recipientId: me.id, kind: "mencao", actor: "x", title: "t", body: "", href: "/", ref: "tarefa:1" },
  ]);
  await createGroup(scope, me.id, [outro.id, terceiro.id]);
  await updateAgencySettings(scope, { clientDefaults: { billingDay: 5 } });
  return me;
}

const meA = await agencia(AGENCIA_A, "dona@a.com", "colega@a.com");
const meB = await agencia(AGENCIA_B, "dona@b.com", "colega@b.com");

describe("perfil do membro", () => {
  test("cargo, avisos e presença gravam em quem pediu", async () => {
    const me = await updateMyProfile(AGENCIA_A, meA.id, {
      title: "  Designer  ",
      notify: { kinds: { mensagem: false }, sound: "sino" },
      presence: "ocupado",
    });
    assert.equal(me?.title, "Designer");
    assert.equal(me?.notify.kinds.mensagem, false);
    assert.equal(me?.notify.sound, "sino");
    assert.equal(me?.presence, "ocupado");
  });

  test("foto só de mídia do próprio app", async () => {
    await assert.rejects(updateMyProfile(AGENCIA_A, meA.id, { photoUrl: "https://evil.com/a.png" }), ValidationError);
    const ok = "/api/media/" + "b".repeat(32);
    assert.equal((await updateMyProfile(AGENCIA_A, meA.id, { photoUrl: ok }))?.photoUrl, ok);
  });

  test("membro de outra agência não é alcançado", async () => {
    assert.equal(await updateMyProfile(AGENCIA_B, meA.id, { title: "x" }), undefined);
  });
});

describe("conta e agência", () => {
  test("renomear troca o nome de todas as contas da agência, e só dela", async () => {
    await renameAgency(AGENCIA_A.agencyId, "  Estúdio Novo ");
    const users = await listUsers();
    assert.equal(users.find((u) => u.email === "dona@a.com")?.agency, "Estúdio Novo");
    assert.notEqual(users.find((u) => u.email === "dona@b.com")?.agency, "Estúdio Novo");
  });

  test("sair de todos os aparelhos sobe a versão da sessão", async () => {
    const user = (await listUsers()).find((u) => u.email === "dona@a.com")!;
    const antes = await getPasswordVersion(user.id);
    await revokeSessions(user.id);
    assert.equal(await getPasswordVersion(user.id), antes + 1);
  });

  test("ajustes da agência: grava validado e separado por agência", async () => {
    await assert.rejects(updateAgencySettings(AGENCIA_A, { clientDefaults: { billingDay: 99 } }), AgencySettingsError);
    await assert.rejects(updateAgencySettings(AGENCIA_A, { logoUrl: "https://evil.com/x.png" }), AgencySettingsError);
    await updateAgencySettings(AGENCIA_A, { clientDefaults: { billingDay: 10, paymentKind: "pix" } });
    assert.equal((await getAgencySettings(AGENCIA_A)).clientDefaults.billingDay, 10);
    assert.equal((await getAgencySettings(AGENCIA_B)).clientDefaults.billingDay, 5);
  });
});

describe("excluir agência", () => {
  test("a A some de todas as áreas; a B fica inteira", async () => {
    const result = await deleteAgency(AGENCIA_A);
    assert.equal(result.users, 1);

    for (const [scope, vazio] of [
      [AGENCIA_A, true],
      [AGENCIA_B, false],
    ] as const) {
      const n = (list: unknown[]) => (vazio ? list.length === 0 : list.length > 0);
      assert.ok(n(await listTasks(scope)), "tarefas");
      assert.ok(n(await listClients(scope)), "clientes");
      assert.ok(n(await listAccounts(scope)), "fichas");
      assert.ok(n(await listFlows(scope)), "fluxos");
      assert.ok(n(await listMembers(scope)), "membros");
      const me = scope === AGENCIA_A ? meA : meB;
      assert.ok(n(await listNotifications(scope, me.id)), "notificações");
      const data = await readInbox();
      assert.ok(n(data.conversations.filter((c) => c.agencyId === scope.agencyId)), "conversas");
    }
    assert.equal((await getAgencySettings(AGENCIA_A)).clientDefaults.billingDay, null);
    assert.equal((await getAgencySettings(AGENCIA_B)).clientDefaults.billingDay, 5);
    const emails = (await listUsers()).map((u) => u.email);
    assert.ok(!emails.includes("dona@a.com"));
    assert.ok(emails.includes("dona@b.com"));
  });
});

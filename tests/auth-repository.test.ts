import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Base de contas só deste teste, vazia (ver helpers/data-dir.ts).
usarDataDirTemporario("auth");
escreverData("users.json", []);

const {
  AuthError,
  authenticate,
  changePassword,
  getPasswordVersion,
  getUserForSession,
  isRole,
  registerUser,
  updateProfile,
} = await import("../src/lib/auth/repository");

let n = 0;
const novaConta = () =>
  registerUser({
    name: "Felipe",
    email: `felipe${n++}@blackberry.app`,
    password: "blackberry",
  });

describe("registerUser", () => {
  test("cria a conta na versão 1 de senha e sem devolver o hash", async () => {
    const user = await novaConta();
    assert.equal(await getPasswordVersion(user.id), 1);
    assert.ok(!("passwordHash" in user), "o hash não pode sair do servidor");
    assert.equal(user.role, "coordenacao", "papel padrão");
    assert.ok(user.agency.length > 0, "agência tem um padrão a partir do nome");
    assert.ok(user.agencyId.length > 0, "toda conta nasce com um tenant");
  });

  test("cada cadastro abre um tenant novo, mesmo com o nome de uma agência existente", async () => {
    const primeira = await registerUser({
      name: "Felipe",
      email: `a${n++}@blackberry.app`,
      password: "blackberry",
      agency: "Estúdio Norte",
    });
    const segunda = await registerUser({
      name: "Outra pessoa",
      email: `a${n++}@blackberry.app`,
      password: "blackberry",
      agency: "Estúdio Norte",
    });
    assert.notEqual(
      primeira.agencyId,
      segunda.agencyId,
      "digitar o nome de uma agência não coloca ninguém dentro dela",
    );
    assert.ok(segunda.agencyId.startsWith("estudio-norte-"), "o id continua legível");
  });

  test("normaliza o e-mail e recusa duplicata", async () => {
    const email = `dup${n++}@blackberry.app`;
    const user = await registerUser({ name: "A", email: `  ${email.toUpperCase()} `, password: "blackberry" });
    assert.equal(user.email, email);
    await assert.rejects(
      () => registerUser({ name: "B", email, password: "blackberry" }),
      AuthError,
    );
  });

  test("valida nome, e-mail e tamanho da senha", async () => {
    const base = { name: "A", email: `v${n++}@blackberry.app`, password: "blackberry" };
    await assert.rejects(() => registerUser({ ...base, name: "  " }), AuthError);
    await assert.rejects(() => registerUser({ ...base, email: "sem-arroba" }), AuthError);
    await assert.rejects(() => registerUser({ ...base, password: "curta" }), AuthError);
  });

  test("isRole só aceita os papéis do produto", () => {
    assert.equal(isRole("coordenacao"), true);
    assert.equal(isRole("designer"), true);
    assert.equal(isRole("chefe"), false);
    assert.equal(isRole(undefined), false);
  });
});

describe("authenticate", () => {
  test("entra com a senha certa", async () => {
    const user = await novaConta();
    const entrou = await authenticate({ email: user.email, password: "blackberry" });
    assert.equal(entrou.id, user.id);
  });

  test("e-mail inexistente e senha errada dão a mesma mensagem", async () => {
    const user = await novaConta();
    const erros: string[] = [];
    for (const cred of [
      { email: user.email, password: "errada12" },
      { email: "ninguem@blackberry.app", password: "blackberry" },
    ]) {
      await assert.rejects(() => authenticate(cred), (e: Error) => {
        erros.push(e.message);
        return e instanceof AuthError;
      });
    }
    assert.equal(erros[0], erros[1], "não entregar quais e-mails existem");
  });
});

describe("troca de senha invalida as sessões antigas", () => {
  test("a versão da senha sobe a cada troca", async () => {
    const user = await novaConta();
    assert.equal(await changePassword(user.id, "blackberry", "novasenha1"), 2);
    assert.equal(await getPasswordVersion(user.id), 2);
    assert.equal(await changePassword(user.id, "novasenha1", "novasenha2"), 3);
  });

  test("o token emitido antes da troca deixa de valer", async () => {
    const user = await novaConta();
    const versaoNoLogin = await getPasswordVersion(user.id);

    assert.equal(
      (await getUserForSession(user.id, versaoNoLogin))?.id,
      user.id,
      "antes da troca, a sessão vale",
    );

    await changePassword(user.id, "blackberry", "novasenha1");

    assert.equal(
      await getUserForSession(user.id, versaoNoLogin),
      undefined,
      "o aparelho que ficou com o token antigo cai",
    );
    assert.equal(
      (await getUserForSession(user.id, versaoNoLogin + 1))?.id,
      user.id,
      "o cookie reemitido na própria troca continua valendo",
    );
  });

  test("só a senha nova entra depois da troca", async () => {
    const user = await novaConta();
    await changePassword(user.id, "blackberry", "novasenha1");
    await assert.rejects(() => authenticate({ email: user.email, password: "blackberry" }), AuthError);
    assert.equal((await authenticate({ email: user.email, password: "novasenha1" })).id, user.id);
  });

  test("senha atual errada ou nova curta demais não mudam nada", async () => {
    const user = await novaConta();
    await assert.rejects(() => changePassword(user.id, "errada12", "novasenha1"), AuthError);
    await assert.rejects(() => changePassword(user.id, "blackberry", "curta"), AuthError);
    assert.equal(await getPasswordVersion(user.id), 1, "a versão não se mexeu");
    assert.equal((await authenticate({ email: user.email, password: "blackberry" })).id, user.id);
  });

  test("usuário inexistente não vira sessão", async () => {
    assert.equal(await getUserForSession("nao-existe", 1), undefined);
    assert.equal(await getPasswordVersion("nao-existe"), 1, "padrão seguro");
    await assert.rejects(() => changePassword("nao-existe", "x", "novasenha1"), AuthError);
  });

  test("editar o perfil não derruba a sessão", async () => {
    const user = await novaConta();
    await updateProfile(user.id, { name: "Felipe Novo", agency: "Estúdio Sul" });
    assert.equal(await getPasswordVersion(user.id), 1);
    assert.equal((await getUserForSession(user.id, 1))?.name, "Felipe Novo");
  });
});

describe("updateProfile", () => {
  test("recusa nome e agência em branco", async () => {
    const user = await novaConta();
    await assert.rejects(() => updateProfile(user.id, { name: "  " }), AuthError);
    await assert.rejects(() => updateProfile(user.id, { agency: "  " }), AuthError);
    await assert.rejects(() => updateProfile("nao-existe", { name: "x" }), AuthError);
  });

  test("não mexe no e-mail nem no papel", async () => {
    const user = await novaConta();
    const up = await updateProfile(user.id, { name: "Outro" });
    assert.equal(up.email, user.email);
    assert.equal(up.role, user.role);
  });

  test("renomear a agência troca o rótulo, nunca o tenant", async () => {
    const user = await novaConta();
    const up = await updateProfile(user.id, { agency: "Estúdio Sul" });
    assert.equal(up.agency, "Estúdio Sul");
    assert.equal(
      up.agencyId,
      user.agencyId,
      "se o id mudasse, a agência perderia de vista tudo que já produziu",
    );
  });
});

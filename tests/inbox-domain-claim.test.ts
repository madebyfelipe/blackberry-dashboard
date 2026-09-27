import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { escopo } from "./helpers/agency";
import { usarDataDirTemporario } from "./helpers/data-dir";

/*
 * Reivindicar o domínio do convite automático (issue #92). O cadastro não
 * confirma e-mail, então "tenho e-mail no domínio" é prova fraca: o primeiro
 * a cadastrar `alguem@bigcorp.com` levaria o domínio inteiro. Enquanto não
 * existe confirmação por e-mail, a reivindicação é recusada quando o domínio
 * já tem gente em outra agência, ou já é de outra agência.
 */
usarDataDirTemporario("dominio");

const { ValidationError, ensureMember, getTeamSettings, setTeamDomain } = await import(
  "../src/lib/inbox/repository"
);

const LEGITIMA = escopo("BigCorp de verdade");
const INTRUSA = escopo("Agência do intruso");
const OUTRA = escopo("Estúdio Sul");
const GMAIL = escopo("Agência do Gmail");
const SUL_2 = escopo("Sul 2");

await ensureMember(LEGITIMA, { name: "Dona", email: "dona@bigcorp.com" });
const intruso = await ensureMember(INTRUSA, { name: "Intruso", email: "alguem@bigcorp.com" });
const sul = await ensureMember(OUTRA, { name: "Sul", email: "ana@estudiosul.com" });

describe("setTeamDomain", () => {
  test("domínio com gente em outra agência não pode ser reivindicado", async () => {
    await assert.rejects(
      setTeamDomain(INTRUSA, intruso.id, { domain: "bigcorp.com" }),
      (err: unknown) => err instanceof ValidationError && /outra agência/.test(err.message),
    );
    assert.equal((await getTeamSettings(INTRUSA)).domain, null);
  });

  test("domínio pessoal nunca", async () => {
    const g = await ensureMember(GMAIL, { name: "G", email: "g@gmail.com" });
    await assert.rejects(setTeamDomain(GMAIL, g.id, { domain: "gmail.com" }), ValidationError);
  });

  test("domínio só desta agência, do e-mail de quem configura: vale", async () => {
    const s = await setTeamDomain(OUTRA, sul.id, { domain: "estudiosul.com" });
    assert.equal(s.domain, "estudiosul.com");
  });

  test("domínio já reivindicado por outra agência não troca de dona", async () => {
    const outro = await ensureMember(SUL_2, { name: "S2", email: "bia@estudiosul.com" });
    await assert.rejects(setTeamDomain(SUL_2, outro.id, { domain: "estudiosul.com" }), ValidationError);
  });
});

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { usarDataDirTemporario } from "./helpers/data-dir";

usarDataDirTemporario("anexo-dono");

const { saveMedia, claimAttachments, getMedia, MediaError } = await import("../src/lib/media/store");
const { ATTACHMENT_POLICY, ART_POLICY, blobPathnameFor } = await import("../src/lib/media/constants");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const DONO = { agencyId: "a", uploaderId: "felipe", conversationId: "g1" };

describe("anexo tem dono e vai numa mensagem só", () => {
  test("prende o anexo de quem subiu, nesta conversa — uma vez", async () => {
    const m = await saveMedia(PNG, { mime: "image/png", name: "x.png", owner: { ...DONO, messageId: null } }, ATTACHMENT_POLICY);
    assert.deepEqual(await claimAttachments([m.id], DONO, "msg1"), [m.id]);
    assert.equal((await getMedia(m.id))?.owner?.messageId, "msg1");
    // Segunda mensagem com o mesmo anexo: não prende.
    assert.deepEqual(await claimAttachments([m.id], DONO, "msg2"), []);
  });

  test("arte de lote (sem dono) e anexo de outra pessoa/conversa não entram", async () => {
    const arte = await saveMedia(PNG, { mime: "image/png", name: "arte.png" });
    const alheio = await saveMedia(PNG, { mime: "image/png", name: "y.png", owner: { ...DONO, messageId: null } }, ATTACHMENT_POLICY);
    assert.deepEqual(await claimAttachments([arte.id], DONO, "m"), []);
    assert.deepEqual(await claimAttachments([alheio.id], { ...DONO, uploaderId: "marina" }, "m"), []);
    assert.deepEqual(await claimAttachments([alheio.id], { ...DONO, conversationId: "g2" }, "m"), []);
    assert.deepEqual(await claimAttachments([alheio.id], { ...DONO, agencyId: "b" }, "m"), []);
  });
});

/*
 * Issue #95: o tipo vem de quem envia, e `tabela[mime]` achava o protótipo —
 * "constructor" passava como aceito, com `kind` e extensão indefinidos.
 */
describe("tipo com nome do protótipo", () => {
  for (const mime of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    test(`"${mime}" é recusado em toda porta de upload`, async () => {
      for (const policy of [ART_POLICY, ATTACHMENT_POLICY]) {
        await assert.rejects(() => saveMedia(PNG, { mime, name: "x" }, policy), MediaError);
      }
      assert.equal(blobPathnameFor("arte", mime), "media/arte.bin");
    });
  }
});

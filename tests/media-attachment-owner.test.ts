import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { usarDataDirTemporario } from "./helpers/data-dir";

usarDataDirTemporario("anexo-dono");

const { saveMedia, claimAttachments, getMedia } = await import("../src/lib/media/store");
const { ATTACHMENT_POLICY } = await import("../src/lib/media/constants");

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

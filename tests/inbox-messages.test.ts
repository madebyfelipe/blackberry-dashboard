import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

usarDataDirTemporario("inbox-mensagens");

const T0 = Date.parse("2026-09-20T12:00:00.000Z");
const MIN = 60_000;

escreverData("inbox.json", {
  members: [
    { id: "felipe", agencyId: AGENCIA_A.agencyId, name: "Felipe", email: "f@bb.app", presence: "disponivel" },
    { id: "marina", agencyId: AGENCIA_A.agencyId, name: "Marina", email: "", presence: "disponivel" },
  ],
  conversations: [
    {
      id: "g1",
      agencyId: AGENCIA_A.agencyId,
      kind: "grupo",
      name: "Montê bar",
      memberIds: ["felipe", "marina"],
      messages: [
        // Gravada antes de anexo/resposta/edição existirem: continua valendo.
        { id: "velha", authorId: "felipe", text: "oi", createdAt: new Date(T0).toISOString(), kind: "texto" },
        { id: "da-marina", authorId: "marina", text: "opa", createdAt: new Date(T0).toISOString(), kind: "texto" },
        {
          id: "so-anexo",
          authorId: "marina",
          text: "",
          createdAt: new Date(T0).toISOString(),
          kind: "texto",
          attachments: [{ id: "a1", kind: "arquivo", url: "/api/media/a1", name: "briefing.pdf", mime: "application/pdf", size: 10 }],
        },
      ],
      mutedBy: [],
      readAt: {},
      createdAt: new Date(T0).toISOString(),
    },
  ],
});

const { ForbiddenError, ValidationError, deleteMessage, editMessage, getConversation, sendMessage } =
  await import("../src/lib/inbox/repository");
const { messageText } = await import("../src/lib/inbox/view");

describe("mensagem gravada antes dos campos novos", () => {
  test("ganha os padrões na leitura, e a só-anexo sobrevive", async () => {
    const c = await getConversation(AGENCIA_A, "felipe", "g1");
    const velha = c!.messages.find((m) => m.id === "velha")!;
    assert.deepEqual(velha.attachments, []);
    assert.equal(velha.replyToId, null);
    assert.equal(velha.editedAt, null);
    assert.equal(velha.deletedAt, null);
    const soAnexo = c!.messages.find((m) => m.id === "so-anexo")!;
    assert.equal(messageText(soAnexo), "Arquivo: briefing.pdf");
  });
});

describe("responder e anexar", () => {
  test("resposta aponta para a mensagem da conversa; id estranho vira mensagem comum", async () => {
    let c = await sendMessage(AGENCIA_A, "felipe", "g1", "boa", { replyToId: "da-marina" });
    assert.equal(c!.messages.at(-1)!.replyToId, "da-marina");
    c = await sendMessage(AGENCIA_A, "felipe", "g1", "boa", { replyToId: "nao-existe" });
    assert.equal(c!.messages.at(-1)!.replyToId, null);
  });

  test("só anexo, sem texto, pode; sem nada, não", async () => {
    const gif = { id: "gif-1", kind: "gif" as const, url: "https://media.tenor.com/x.gif", name: "GIF", mime: "image/gif", size: 0 };
    const c = await sendMessage(AGENCIA_A, "felipe", "g1", "  ", { attachments: [gif] });
    assert.equal(c!.messages.at(-1)!.attachments[0].kind, "gif");
    await assert.rejects(() => sendMessage(AGENCIA_A, "felipe", "g1", "  "), ValidationError);
  });
});

describe("editar e apagar: a sua, até 10 minutos", () => {
  test("edita dentro da janela e marca como editada", async () => {
    const c = await sendMessage(AGENCIA_A, "felipe", "g1", "tetxo");
    const id = c!.messages.at(-1)!.id;
    const sentAt = Date.parse(c!.messages.at(-1)!.createdAt);
    const edited = await editMessage(AGENCIA_A, "felipe", "g1", id, "texto", sentAt + 9 * MIN);
    const m = edited!.messages.find((x) => x.id === id)!;
    assert.equal(m.text, "texto");
    assert.ok(m.editedAt);
  });

  test("depois de 10 minutos, recusa", async () => {
    const c = await sendMessage(AGENCIA_A, "felipe", "g1", "tarde demais");
    const m = c!.messages.at(-1)!;
    const later = Date.parse(m.createdAt) + 11 * MIN;
    await assert.rejects(() => editMessage(AGENCIA_A, "felipe", "g1", m.id, "x", later), ForbiddenError);
    await assert.rejects(() => deleteMessage(AGENCIA_A, "felipe", "g1", m.id, later), ForbiddenError);
  });

  test("a de outra pessoa, nunca", async () => {
    const c = await sendMessage(AGENCIA_A, "marina", "g1", "minha");
    const m = c!.messages.at(-1)!;
    await assert.rejects(() => editMessage(AGENCIA_A, "felipe", "g1", m.id, "sua"), ForbiddenError);
    await assert.rejects(() => deleteMessage(AGENCIA_A, "felipe", "g1", m.id), ForbiddenError);
  });

  test("apagar deixa a marca, tira texto e anexos e devolve o que saiu", async () => {
    const file = { id: "b".repeat(32), kind: "arquivo" as const, url: "/api/media/x", name: "a.pdf", mime: "application/pdf", size: 3 };
    const c = await sendMessage(AGENCIA_A, "felipe", "g1", "com anexo", { attachments: [file] });
    const m = c!.messages.at(-1)!;
    const result = await deleteMessage(AGENCIA_A, "felipe", "g1", m.id);
    assert.deepEqual(result!.removed.map((a) => a.id), [file.id]);
    const gone = result!.conversation.messages.find((x) => x.id === m.id)!;
    assert.equal(gone.text, "");
    assert.deepEqual(gone.attachments, []);
    assert.ok(gone.deletedAt);
    assert.equal(messageText(gone), "Mensagem apagada");
    // Apagada não se edita nem se apaga de novo.
    await assert.rejects(() => editMessage(AGENCIA_A, "felipe", "g1", m.id, "volta"), ForbiddenError);
  });

  test("mensagem que não existe (ou de conversa alheia) responde como inexistente", async () => {
    assert.equal(await editMessage(AGENCIA_A, "felipe", "g1", "nada", "x"), undefined);
    assert.equal(await deleteMessage(AGENCIA_A, "felipe", "nao-existe", "velha"), undefined);
  });
});

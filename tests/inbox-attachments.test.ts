import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { attachmentsLabel, canChangeMessage, isGifUrl } from "../src/lib/inbox/constants";
import {
  ART_POLICY,
  ATTACHMENT_POLICY,
  BLOB_ATTACHMENT_PREFIX,
  baseMime,
  blobPathnameFor,
  isMediaBlobPathname,
} from "../src/lib/media/constants";

describe("GIF: só do CDN do Giphy e do Tenor", () => {
  test("aceita os endereços das duas bibliotecas", () => {
    assert.ok(isGifUrl("https://media.tenor.com/abc/tenor.gif"));
    assert.ok(isGifUrl("https://media2.giphy.com/media/xyz/200.gif?cid=1"));
    assert.ok(isGifUrl("https://i.giphy.com/xyz.gif"));
  });

  test("recusa o resto — outro host, http, host parecido, lixo", () => {
    assert.equal(isGifUrl("http://media.tenor.com/x.gif"), false);
    assert.equal(isGifUrl("https://evil.com/x.gif"), false);
    assert.equal(isGifUrl("https://media.tenor.com.evil.com/x.gif"), false);
    assert.equal(isGifUrl("https://giphy.com.evil.io/x.gif"), false);
    assert.equal(isGifUrl("javascript:alert(1)"), false);
    assert.equal(isGifUrl("não é url"), false);
  });
});

describe("a janela de editar/apagar", () => {
  const at = "2026-09-20T12:00:00.000Z";
  const t0 = Date.parse(at);
  const msg = { authorId: "felipe", kind: "texto", createdAt: at, deletedAt: null };

  test("a sua, até 10 minutos", () => {
    assert.equal(canChangeMessage(msg, "felipe", t0 + 10 * 60_000), true);
    assert.equal(canChangeMessage(msg, "felipe", t0 + 10 * 60_000 + 1), false);
  });

  test("de outra pessoa, de sistema ou apagada, nunca", () => {
    assert.equal(canChangeMessage(msg, "marina", t0), false);
    assert.equal(canChangeMessage({ ...msg, kind: "chamada" }, "felipe", t0), false);
    assert.equal(canChangeMessage({ ...msg, deletedAt: at }, "felipe", t0), false);
  });
});

describe("o que a prévia diz de um anexo", () => {
  test("voz, GIF, imagem e arquivo com o nome", () => {
    assert.equal(attachmentsLabel([{ kind: "audio", name: "x.webm" }]), "Mensagem de voz");
    assert.equal(attachmentsLabel([{ kind: "gif", name: "" }]), "GIF");
    assert.equal(attachmentsLabel([{ kind: "arquivo", name: "briefing.pdf" }, { kind: "imagem", name: "a" }]), "Arquivo: briefing.pdf (+1)");
    assert.equal(attachmentsLabel([]), "");
  });
});

describe("anexos no armazenamento", () => {
  test("20 MB e a pasta própria; as artes continuam com 50 MB em media/", () => {
    assert.equal(ATTACHMENT_POLICY.maxBytes, 20 * 1024 * 1024);
    assert.equal(ART_POLICY.maxBytes, 50 * 1024 * 1024);
    assert.equal(ATTACHMENT_POLICY.prefix, BLOB_ATTACHMENT_PREFIX);
  });

  test("tipos do dia a dia entram; nada que o navegador execute", () => {
    for (const ok of ["application/pdf", "audio/webm", "image/png", "text/csv"]) {
      assert.ok(ATTACHMENT_POLICY.accepted[ok], ok);
    }
    for (const no of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload"]) {
      assert.equal(ATTACHMENT_POLICY.accepted[no], undefined, no);
    }
    // Arte de lote continua só imagem e vídeo.
    assert.equal(ART_POLICY.accepted["application/pdf"], undefined);
  });

  test("o tipo do gravador vem sem os parâmetros", () => {
    assert.equal(baseMime("audio/webm;codecs=opus"), "audio/webm");
    assert.equal(baseMime(" Audio/MP4 "), "audio/mp4");
  });

  test("pathname do anexo nasce em anexos/ e só é aceito lá", () => {
    const p = blobPathnameFor("Briefing Final.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", BLOB_ATTACHMENT_PREFIX);
    assert.equal(p, "anexos/briefing-final.docx");
    assert.ok(isMediaBlobPathname("anexos/briefing-final-AbC12.docx", BLOB_ATTACHMENT_PREFIX));
    assert.equal(isMediaBlobPathname("anexos/briefing-final.docx"), false);
    assert.equal(isMediaBlobPathname("media/../anexos/x.pdf", BLOB_ATTACHMENT_PREFIX), false);
  });
});

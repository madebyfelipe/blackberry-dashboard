import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  BLOB_MEDIA_PREFIX,
  blobPathnameFor,
  isMediaBlobPathname,
} from "../src/lib/media/constants";

/*
 * O pathname é a única coisa que o navegador escolhe no upload direto (issue
 * #11): ele pede um caminho ao emitir o token e devolve outro ao registrar a
 * arte. `isMediaBlobPathname` é o portão dos dois lados, então o que importa
 * aqui é o que ele RECUSA.
 */

describe("blobPathnameFor", () => {
  test("mantém o nome legível e troca a extensão pela do mime", () => {
    assert.equal(
      blobPathnameFor("Campanha Verão.PNG", "image/png"),
      "media/campanha-verao.png",
    );
  });

  test("tira acento, espaço e pontuação do nome", () => {
    assert.equal(
      blobPathnameFor("Ação 2026 — final (v2).jpeg", "image/jpeg"),
      "media/acao-2026-final-v2.jpg",
    );
  });

  test("nome que não sobra nada ainda dá um caminho válido", () => {
    const pathname = blobPathnameFor("###.png", "image/png");
    assert.equal(pathname, "media/arte.png");
    assert.ok(isMediaBlobPathname(pathname));
  });

  test("nome muito longo é cortado, e o que sai é aceito", () => {
    const pathname = blobPathnameFor(`${"a".repeat(200)}.png`, "image/png");
    assert.ok(pathname.length < 80);
    assert.ok(isMediaBlobPathname(pathname));
  });

  test("todo mime aceito produz um caminho que o portão aprova", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/quicktime"]) {
      const pathname = blobPathnameFor("arte final.bin", mime);
      assert.ok(isMediaBlobPathname(pathname), `${mime} → ${pathname}`);
    }
  });
});

describe("isMediaBlobPathname", () => {
  test("aceita o que o Blob devolve, com o sufixo aleatório dele", () => {
    assert.ok(isMediaBlobPathname("media/campanha-verao-Xy9aB2cD3e.png"));
  });

  test("recusa caminho fora de media/", () => {
    for (const bad of [
      "uploads/arte.png",
      "arte.png",
      "/media/arte.png",
      "MEDIA/arte.png",
    ]) {
      assert.equal(isMediaBlobPathname(bad), false, bad);
    }
  });

  test("recusa subir de nível ou criar subpasta", () => {
    for (const bad of [
      "media/../secrets.png",
      "media/sub/arte.png",
      "media/..%2Fsecrets.png",
      `${BLOB_MEDIA_PREFIX}a/b.png`,
    ]) {
      assert.equal(isMediaBlobPathname(bad), false, bad);
    }
  });

  test("recusa nome escondido, vazio ou sem extensão", () => {
    for (const bad of ["media/.env", "media/", "media/arte", "media/-arte.png"]) {
      assert.equal(isMediaBlobPathname(bad), false, bad);
    }
  });

  test("recusa query, fragmento e espaço colados no caminho", () => {
    for (const bad of [
      "media/arte.png?token=x",
      "media/arte.png#x",
      "media/arte final.png",
      "media/arte.png\n",
    ]) {
      assert.equal(isMediaBlobPathname(bad), false, bad);
    }
  });

  test("recusa URL inteira — é pathname, não endereço", () => {
    assert.equal(
      isMediaBlobPathname("https://exemplo.public.blob.vercel-storage.com/media/arte.png"),
      false,
    );
  });
});

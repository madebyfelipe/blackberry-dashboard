import assert from "node:assert/strict";
import { register } from "node:module";
import test, { describe } from "node:test";

import { usarDataDirTemporario } from "./helpers/data-dir";
import { fakeBlob } from "./helpers/fake-blob";

/*
 * Issue #73: o pathname de um blob não é segredo (vai no `Location` do 307
 * de `/api/media/<id>` e, antes, ia nas props do link público). Sem amarrar
 * o upload a quem pediu o token, a agência B registrava o pathname da arte
 * da agência A como mídia sua e, ao apagar, levava o arquivo da A junto.
 * Aqui o ataque roda contra `saveBlobMedia`/`deleteMedia` de verdade, com um
 * Blob de mentira.
 */

usarDataDirTemporario("blob-dono");
process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_fake_segredo";
register("./helpers/fake-blob-hook.mjs", import.meta.url);

const { MediaError, deleteMedia, getMedia, saveBlobMedia, transactionMediaIndex } = await import(
  "../src/lib/media/store"
);
const { UPLOAD_TARGET, issueUploadGrant, requestedPathnameOf } = await import(
  "../src/lib/media/upload-grants"
);
const { ATTACHMENT_POLICY, BLOB_ATTACHMENT_PREFIX, blobPathnameFor } = await import(
  "../src/lib/media/constants"
);

const A = { agencyId: "agencia-a", uploaderId: "ana", target: UPLOAD_TARGET.peca("lote-a", "peca-a") };
const B = { agencyId: "agencia-b", uploaderId: "bruno", target: UPLOAD_TARGET.peca("lote-b", "peca-b") };

let seq = 0;

/** O que o navegador faz: pede o token, sobe o arquivo, e o Blob põe o sufixo. */
async function upload(owner: typeof A, name = "Campanha.png"): Promise<string> {
  const requested = blobPathnameFor(name, "image/png");
  assert.equal(await issueUploadGrant(requested, owner), true);
  const pathname = requested.replace(/\.png$/, `-Sfx${++seq}AbC.png`);
  fakeBlob().objects.set(pathname, { contentType: "image/png", size: 1234 });
  return pathname;
}

async function rejects(p: Promise<unknown>, message: RegExp) {
  await assert.rejects(p, (err: unknown) => err instanceof MediaError && message.test(err.message));
}

describe("upload direto amarrado a quem pediu o token (issue #73)", () => {
  test("agência B não registra nem apaga a arte da agência A", async () => {
    const pathname = await upload(A);
    const arte = await saveBlobMedia({ pathname, name: "Campanha.png", grant: A });

    // B tem a própria permissão (outro upload), mas não a deste pathname.
    await upload(B);
    await rejects(saveBlobMedia({ pathname, name: "roubo.png", grant: B }), /não autorizado/);

    // Nem pedindo token para o mesmo pathname que a A pediu: já tem registro.
    const requested = requestedPathnameOf(pathname)!;
    assert.equal(await issueUploadGrant(requested, B), true);
    await rejects(saveBlobMedia({ pathname, name: "roubo.png", grant: B }), /já foi registrado/);

    // O objeto e o registro da A continuam lá.
    assert.ok(fakeBlob().objects.has(pathname));
    assert.equal((await getMedia(arte.id))?.blobPathname, pathname);
    assert.deepEqual(fakeBlob().deleted, []);
  });

  test("permissão pendente de uma pessoa não é dada a outra", async () => {
    const requested = blobPathnameFor("Arte.png", "image/png");
    assert.equal(await issueUploadGrant(requested, A), true);
    assert.equal(await issueUploadGrant(requested, B), false);
    // A mesma pessoa pedindo de novo (retentativa) só renova.
    assert.equal(await issueUploadGrant(requested, A), true);
  });

  test("a permissão vale só para a mesma agência, pessoa e destino", async () => {
    for (const other of [
      { ...A, agencyId: "agencia-b" },
      { ...A, uploaderId: "marina" },
      { ...A, target: UPLOAD_TARGET.peca("lote-a", "outra-peca") },
      { ...A, target: UPLOAD_TARGET.conversa("g1") },
    ]) {
      const pathname = await upload(A);
      await rejects(saveBlobMedia({ pathname, name: "x.png", grant: other }), /não autorizado/);
    }
  });

  test("uma permissão, um registro: o mesmo pathname não entra duas vezes", async () => {
    const pathname = await upload(A);
    await saveBlobMedia({ pathname, name: "x.png", grant: A });
    await rejects(saveBlobMedia({ pathname, name: "x.png", grant: A }), /não autorizado|já foi registrado/);
  });

  test("pathname sem o sufixo do Blob (nunca saiu de um token) é recusado", async () => {
    // O formato do `putBlob` do servidor: `media/<id>.<ext>`.
    const pathname = "media/0123456789abcdef0123456789abcdef.png";
    fakeBlob().objects.set(pathname, { contentType: "image/png", size: 10 });
    assert.equal(requestedPathnameOf(pathname), undefined);
    await rejects(saveBlobMedia({ pathname, name: "x.png", grant: A }), /não autorizado/);
  });

  test("vale para anexo do Inbox e arquivo da ficha também", async () => {
    const conversa = { agencyId: "agencia-a", uploaderId: "ana", target: UPLOAD_TARGET.conversa("g1") };
    const requested = blobPathnameFor("Briefing.pdf", "application/pdf", BLOB_ATTACHMENT_PREFIX);
    assert.equal(await issueUploadGrant(requested, conversa), true);
    const pathname = requested.replace(/\.pdf$/, "-Zz9.pdf");
    fakeBlob().objects.set(pathname, { contentType: "application/pdf", size: 99 });

    const intruso = { agencyId: "agencia-b", uploaderId: "bruno", target: UPLOAD_TARGET.cliente("c1") };
    await rejects(saveBlobMedia({ pathname, name: "x.pdf", grant: intruso }, ATTACHMENT_POLICY), /não autorizado/);
    const anexo = await saveBlobMedia({ pathname, name: "Briefing.pdf", grant: conversa }, ATTACHMENT_POLICY);
    assert.equal(anexo.blobPathname, pathname);
  });

  test("cópia que já existia não apaga o blob de quem ainda o usa", async () => {
    const pathname = await upload(A);
    const arte = await saveBlobMedia({ pathname, name: "Campanha.png", grant: A });
    // Uma cópia registrada antes da correção, apontando para o mesmo objeto.
    await transactionMediaIndex((map) => {
      map.copia = { ...arte, id: "copia", url: "/api/media/copia" };
    });

    await deleteMedia("copia");
    assert.equal(await getMedia("copia"), undefined);
    assert.ok(fakeBlob().objects.has(pathname), "o blob da A não pode sumir");
    assert.ok(!fakeBlob().deleted.includes(pathname));

    // Quando o último registro sai, o blob sai junto.
    await deleteMedia(arte.id);
    assert.ok(fakeBlob().deleted.includes(pathname));
  });
});

describe("blobPathnameFor", () => {
  test("cada pedido é único, para duas permissões nunca disputarem o mesmo caminho", () => {
    const a = blobPathnameFor("arte.png", "image/png");
    const b = blobPathnameFor("arte.png", "image/png");
    assert.notEqual(a, b);
    assert.match(a, /^media\/arte-[0-9a-f]{16}\.png$/);
  });
});

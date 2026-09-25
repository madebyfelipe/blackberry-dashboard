import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

import { BLOB_ACCESS, BLOB_STORE_NOT_PRIVATE, friendlyBlobError } from "../src/lib/media/constants";

/*
 * Issue #39: todo objeto do Blob é privado — o que o servidor grava e o que o
 * navegador sobe direto. A #39 trocou só o servidor, e os três envios diretos
 * (arte do lote, arquivo da ficha, anexo do Inbox) seguiram pedindo
 * "public": num store privado a Vercel recusa, e as artes parariam de subir
 * justo depois de o store ser recriado. Este teste prende as duas pontas.
 */

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("acesso do Blob", () => {
  test("é privado", () => {
    assert.equal(BLOB_ACCESS, "private");
  });

  test("nenhum envio no código pede acesso público", () => {
    const offenders = files(SRC).filter((f) => /access:\s*["']public["']/.test(readFileSync(f, "utf8")));
    assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), []);
  });

  test("o erro do store público vira a mensagem clara; o resto passa como veio", () => {
    const vercel = new Error("Vercel Blob: Cannot use private access on a public store.");
    assert.equal(friendlyBlobError(vercel).message, BLOB_STORE_NOT_PRIVATE);
    const other = new Error("Network down");
    assert.equal(friendlyBlobError(other), other);
    assert.equal(friendlyBlobError("x").message, "Falha ao enviar o arquivo.");
  });
});

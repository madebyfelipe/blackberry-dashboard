import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { createSignedUrlCache, redirectMaxAge } from "../src/lib/media/signed-cache";

const MIN = 60 * 1000;

function signer() {
  const calls: string[] = [];
  const sign = async (pathname: string, validUntil: number) => {
    calls.push(pathname);
    return `https://blob.test/${pathname}?ate=${validUntil}`;
  };
  return { calls, sign };
}

const opts = { ttlMs: 30 * MIN, minRemainingMs: 10 * MIN, maxEntries: 3 };

describe("URL assinada da arte em cache", () => {
  test("a mesma arte reusa a URL enquanto ela tem folga", async () => {
    const { calls, sign } = signer();
    const get = createSignedUrlCache(sign, opts);
    const a = await get("arte/1.png", 0);
    const b = await get("arte/1.png", 19 * MIN);
    assert.equal(a.url, b.url);
    assert.equal(calls.length, 1);
  });

  test("perto de vencer, assina outra", async () => {
    const { calls, sign } = signer();
    const get = createSignedUrlCache(sign, opts);
    const a = await get("arte/1.png", 0);
    const b = await get("arte/1.png", 21 * MIN);
    assert.notEqual(a.url, b.url);
    assert.equal(b.validUntil, 51 * MIN);
    assert.equal(calls.length, 2);
  });

  test("pedidos simultâneos da mesma arte esperam a mesma assinatura", async () => {
    const { calls, sign } = signer();
    const get = createSignedUrlCache(sign, opts);
    const [a, b, c] = await Promise.all([get("x", 0), get("x", 0), get("x", 0)]);
    assert.equal(a.url, b.url);
    assert.equal(b.url, c.url);
    assert.equal(calls.length, 1);
  });

  test("falha na assinatura não fica guardada", async () => {
    let fail = true;
    const get = createSignedUrlCache(async (p) => {
      if (fail) throw new Error("API do Blob fora");
      return `ok/${p}`;
    }, opts);
    await assert.rejects(get("x", 0));
    fail = false;
    assert.equal((await get("x", 0)).url, "ok/x");
  });

  test("respeita o teto de entradas, tirando a menos usada", async () => {
    const { calls, sign } = signer();
    const get = createSignedUrlCache(sign, opts);
    for (const p of ["a", "b", "c"]) await get(p, 0);
    await get("a", 0); // "a" volta para o fim da fila
    await get("d", 0); // estoura o teto: sai "b"
    calls.length = 0;
    await get("a", 0);
    await get("b", 0);
    assert.deepEqual(calls, ["b"]);
  });

  test("o navegador guarda o redirect só até a margem antes de vencer", () => {
    const signed = { url: "u", validUntil: 30 * MIN };
    assert.equal(redirectMaxAge(signed, 5 * MIN, 0), 25 * 60);
    assert.equal(redirectMaxAge(signed, 5 * MIN, 28 * MIN), 0);
  });
});

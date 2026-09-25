import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  isInStore,
  migrateBlobToPrivate,
  pathnameOf,
  storeIdFromToken,
} from "../src/lib/maintenance/migrate-blob-private";
import type { MediaAsset } from "../src/lib/media/types";

/*
 * A cópia do store público antigo para o privado novo (issue #39), com um
 * Blob de mentira: copia quem está no antigo, pula quem já está no novo,
 * não para por uma falha e pode rodar de novo sem repetir nada.
 */

const OLD = "https://abc123.public.blob.vercel-storage.com";
const NEW_ID = "xyz789";
const NEW = `https://${NEW_ID}.private.blob.vercel-storage.com`;

function asset(id: string, blobUrl?: string, blobPathname?: string): MediaAsset {
  return {
    id,
    url: `/api/media/${id}`,
    kind: "image",
    mime: "image/png",
    name: `${id}.png`,
    size: 3,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...(blobUrl ? { blobUrl } : {}),
    ...(blobPathname ? { blobPathname } : {}),
  };
}

function fakeStore(index: Record<string, MediaAsset>, broken = new Set<string>()) {
  const uploaded: string[] = [];
  return {
    uploaded,
    deps: {
      storeId: NEW_ID,
      readIndex: async () => structuredClone(index),
      updateAsset: async (id: string, patch: { blobUrl: string; blobPathname: string }) => {
        Object.assign(index[id], patch);
      },
      download: async (url: string) => {
        if ([...broken].some((b) => url.includes(b))) throw new Error("404");
        return new Uint8Array([1, 2, 3]);
      },
      upload: async (pathname: string) => {
        uploaded.push(pathname);
        return { url: `${NEW}/${pathname}`, pathname };
      },
    },
  };
}

describe("migração para o store privado", () => {
  test("o id do store sai do token", () => {
    assert.equal(storeIdFromToken("vercel_blob_rw_XYZ789_segredo"), "xyz789");
    assert.equal(storeIdFromToken("outra-coisa"), null);
    assert.equal(storeIdFromToken(undefined), null);
  });

  test("de que store é a mídia, e o caminho dela", () => {
    assert.equal(isInStore(`${NEW}/media/a.png`, NEW_ID), true);
    assert.equal(isInStore(`${OLD}/media/a.png`, NEW_ID), false);
    assert.equal(pathnameOf(asset("a", `${OLD}/media/a%20b.png`)), "media/a b.png");
    assert.equal(pathnameOf(asset("a", `${OLD}/x.png`, "media/certo.png")), "media/certo.png");
  });

  test("copia o do store antigo, pula o do novo e o que é só local, e troca o registro", async () => {
    const index = {
      a: asset("a", `${OLD}/media/a.png`, "media/a.png"),
      b: asset("b", `${NEW}/media/b.png`, "media/b.png"),
      local: asset("local"),
    };
    const { deps, uploaded } = fakeStore(index);
    const r = await migrateBlobToPrivate(deps);
    assert.deepEqual(r, { copied: 1, alreadyThere: 1, failed: [] });
    assert.deepEqual(uploaded, ["media/a.png"]);
    assert.equal(index.a.blobUrl, `${NEW}/media/a.png`);

    // De novo: nada a copiar.
    const again = await migrateBlobToPrivate(deps);
    assert.deepEqual(again, { copied: 0, alreadyThere: 2, failed: [] });
  });

  test("uma falha não para as outras, e o registro dela fica como estava", async () => {
    const index = {
      a: asset("a", `${OLD}/media/a.png`, "media/a.png"),
      quebrada: asset("quebrada", `${OLD}/media/quebrada.png`, "media/quebrada.png"),
    };
    const { deps } = fakeStore(index, new Set(["quebrada"]));
    const r = await migrateBlobToPrivate(deps);
    assert.equal(r.copied, 1);
    assert.deepEqual(r.failed, [{ id: "quebrada", reason: "404" }]);
    assert.equal(index.quebrada.blobUrl, `${OLD}/media/quebrada.png`);
  });

  test("--dry-run só conta, não mexe em nada", async () => {
    const index = { a: asset("a", `${OLD}/media/a.png`, "media/a.png") };
    const { deps, uploaded } = fakeStore(index);
    const r = await migrateBlobToPrivate(deps, { dryRun: true });
    assert.equal(r.copied, 1);
    assert.deepEqual(uploaded, []);
    assert.equal(index.a.blobUrl, `${OLD}/media/a.png`);
  });
});

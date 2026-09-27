/*
 * Um Vercel Blob de mentira, em memória: só o que `media/store.ts` usa. O
 * estado fica em `globalThis` para o teste semear objetos e conferir o que
 * foi apagado (ver `fake-blob-hook.mjs`).
 */

type FakeObject = { contentType: string; size: number };

export type FakeBlobState = { objects: Map<string, FakeObject>; deleted: string[] };

const STORE = "https://fake.private.blob.vercel-storage.com";

export function fakeBlob(): FakeBlobState {
  const g = globalThis as { __fakeBlob?: FakeBlobState };
  g.__fakeBlob ??= { objects: new Map(), deleted: [] };
  return g.__fakeBlob;
}

export class BlobError extends Error {}

export async function head(pathname: string) {
  const found = fakeBlob().objects.get(pathname);
  if (!found) throw new BlobError("not found");
  return { url: `${STORE}/${pathname}`, pathname, ...found };
}

export async function put(pathname: string, body: Buffer, options: { contentType: string }) {
  fakeBlob().objects.set(pathname, { contentType: options.contentType, size: body.byteLength });
  return { url: `${STORE}/${pathname}`, pathname };
}

export async function del(url: string) {
  const pathname = url.replace(`${STORE}/`, "");
  fakeBlob().objects.delete(pathname);
  fakeBlob().deleted.push(pathname);
}

/** Sem bytes de verdade: a leitura do cabeçalho só fica sem dimensão. */
export async function get() {
  return null;
}

import assert from "node:assert/strict";
import test, { describe } from "node:test";

/*
 * Verificações do backend de Postgres (issue #11). Sem `DATABASE_URL` o CI
 * pula este arquivo inteiro — nenhum teste da suíte depende de banco — mas
 * quem tiver um Postgres à mão (`DATABASE_URL=postgres://...`) pode rodar
 * `npm test` e validar o `createPostgresStore` de verdade, inclusive o lock
 * de linha (`SELECT ... FOR UPDATE`) que substitui a checagem por mtime do
 * arquivo.
 */
const DATABASE_URL = process.env.DATABASE_URL;

describe("createPostgresStore", { skip: !DATABASE_URL && "requer DATABASE_URL" }, async () => {
  const { createPostgresStore } = await import("../src/lib/store/postgres");

  function novaChave(): string {
    return `teste-${Math.random().toString(36).slice(2)}`;
  }

  await test("semeia na primeira leitura", async () => {
    const store = createPostgresStore<{ n: number }>({
      key: novaChave(),
      seed: () => ({ n: 0 }),
    });
    assert.deepEqual(await store.read(), { n: 0 });
  });

  await test("transaction muta e persiste", async () => {
    const store = createPostgresStore<{ n: number }>({
      key: novaChave(),
      seed: () => ({ n: 0 }),
    });
    await store.transaction((data) => {
      data.n += 1;
    });
    assert.deepEqual(await store.read(), { n: 1 });
  });

  await test("read() nunca devolve a referência viva", async () => {
    const store = createPostgresStore<{ items: string[] }>({
      key: novaChave(),
      seed: () => ({ items: [] }),
    });
    const lido = await store.read();
    lido.items.push("mutação local");
    assert.deepEqual((await store.read()).items, []);
  });

  await test("transactions concorrentes não perdem update (lock de linha)", async () => {
    const store = createPostgresStore<{ items: string[] }>({
      key: novaChave(),
      seed: () => ({ items: [] }),
    });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.transaction((data) => {
          data.items.push("x");
        }),
      ),
    );
    assert.equal((await store.read()).items.length, 20);
  });
});

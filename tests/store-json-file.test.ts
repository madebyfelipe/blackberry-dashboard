import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";

import { usarDataDirTemporario } from "./helpers/data-dir";

// Diretório de dados só deste arquivo (ver helpers/data-dir.ts).
const RAIZ = usarDataDirTemporario("json-store");

const { createJsonStore } = await import("../src/lib/store/json-file");

const arquivo = (nome: string) => path.join(RAIZ, "data", nome);

function ler(nome: string): unknown {
  return JSON.parse(readFileSync(arquivo(nome), "utf8"));
}

/**
 * Grava o arquivo "por fora", como faria outro worker do `next start`.
 *
 * O empurrão no mtime é só garantia para sistemas de arquivo de granularidade
 * grossa: a revalidação do store compara mtime, e num CI com resolução de 1s
 * duas gravações no mesmo segundo pareceriam a mesma versão.
 */
function gravarPorFora(nome: string, conteudo: unknown): void {
  const alvo = arquivo(nome);
  const antes = existsSync(alvo) ? statSync(alvo).mtimeMs : 0;
  writeFileSync(alvo, JSON.stringify(conteudo, null, 2), "utf8");
  if (statSync(alvo).mtimeMs <= antes) {
    const depois = new Date(antes + 1000);
    utimesSync(alvo, depois, depois);
  }
}

let n = 0;
const nomeUnico = () => `store-${n++}.json`;

describe("createJsonStore", () => {
  test("semeia o arquivo na primeira leitura", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => ["semente"] });
    assert.deepEqual(await store.read(), ["semente"]);
    assert.deepEqual(ler(nome), ["semente"], "a semente foi para o disco");
  });

  test("read() devolve cópia: mexer no resultado não afeta o store", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => ["a"] });
    (await store.read()).push("intruso");
    assert.deepEqual(await store.read(), ["a"]);
  });

  test("transaction grava no disco e devolve o valor do callback", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => [] });
    const r = await store.transaction((d) => {
      d.push("x");
      return d.length;
    });
    assert.equal(r, 1);
    assert.deepEqual(ler(nome), ["x"]);
    assert.deepEqual(await store.read(), ["x"]);
  });

  test("revive roda na leitura do arquivo (migração de campos novos)", async () => {
    const nome = nomeUnico();
    gravarPorFora(nome, [{ id: "1" }]);
    const store = createJsonStore<{ id: string; novo: boolean }[]>({
      file: nome,
      seed: () => [],
      revive: (raw) =>
        (raw as { id: string }[]).map((x) => ({ ...x, novo: true })),
    });
    assert.deepEqual(await store.read(), [{ id: "1", novo: true }]);
  });

  /*
   * A regressão que deu origem ao módulo: `next start` roda mais de um worker.
   * Quem grava (route handler) e quem renderiza a tela podem ser processos
   * diferentes, cada um com seu cache. Dois stores sobre o mesmo arquivo são a
   * versão em-processo desse cenário.
   */
  test("relê quando o arquivo muda por fora (dois 'workers')", async () => {
    const nome = nomeUnico();
    const workerA = createJsonStore<string[]>({ file: nome, seed: () => [] });
    const workerB = createJsonStore<string[]>({ file: nome, seed: () => [] });

    assert.deepEqual(await workerA.read(), [], "A cacheia o estado inicial");

    await workerB.transaction((d) => {
      d.push("arte enviada");
    });

    assert.deepEqual(
      await workerA.read(),
      ["arte enviada"],
      "A precisa enxergar o que B acabou de gravar",
    );
  });

  test("relê quando o arquivo é reescrito por outro processo qualquer", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => ["inicial"] });
    assert.deepEqual(await store.read(), ["inicial"]);

    gravarPorFora(nome, ["veio de fora"]);
    assert.deepEqual(await store.read(), ["veio de fora"]);

    gravarPorFora(nome, ["e de novo"]);
    assert.deepEqual(await store.read(), ["e de novo"]);
  });

  test("a transação parte do estado do disco, não do cache do processo", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => ["a"] });
    await store.read(); // cacheia ["a"]

    gravarPorFora(nome, ["a", "b"]); // outro worker acrescentou "b"

    await store.transaction((d) => {
      d.push("c");
    });
    assert.deepEqual(ler(nome), ["a", "b", "c"], "nada foi perdido");
  });

  test("sem mudança no arquivo, leituras seguidas são estáveis", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<{ n: number }>({ file: nome, seed: () => ({ n: 1 }) });
    assert.deepEqual(await store.read(), { n: 1 });
    assert.deepEqual(await store.read(), { n: 1 });
  });

  test("arquivo corrompido não zera os dados de quem já está usando", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => ["valioso"] });
    assert.deepEqual(await store.read(), ["valioso"]);

    // Gravação pela metade / JSON quebrado.
    const alvo = arquivo(nome);
    writeFileSync(alvo, '[{"a":', "utf8");
    const depois = new Date(statSync(alvo).mtimeMs + 1000);
    utimesSync(alvo, depois, depois);

    assert.deepEqual(await store.read(), ["valioso"], "mantém o último estado bom");
  });

  test("transações concorrentes são serializadas (nenhuma escrita se perde)", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<number[]>({ file: nome, seed: () => [] });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.transaction((d) => {
          d.push(i);
        }),
      ),
    );
    const final = (await store.read()).slice().sort((a, b) => a - b);
    assert.deepEqual(final, Array.from({ length: 20 }, (_, i) => i));
  });

  test("uma transação que lança não trava a fila das seguintes", async () => {
    const nome = nomeUnico();
    const store = createJsonStore<string[]>({ file: nome, seed: () => [] });
    await assert.rejects(() =>
      store.transaction(() => {
        throw new Error("falhou no meio");
      }),
    );
    await store.transaction((d) => {
      d.push("depois");
    });
    assert.deepEqual(await store.read(), ["depois"]);
  });
});

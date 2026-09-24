import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { coalesce } from "../src/lib/ui/coalesce";

/** Uma tarefa que só termina quando o teste manda. */
function controlada() {
  let rodadas = 0;
  let emVoo = 0;
  let maxEmVoo = 0;
  const fila: (() => void)[] = [];
  const tarefa = () => {
    rodadas++;
    emVoo++;
    maxEmVoo = Math.max(maxEmVoo, emVoo);
    return new Promise<void>((resolve) =>
      fila.push(() => {
        emVoo--;
        resolve();
      }),
    );
  };
  const soltar = async () => {
    fila.shift()?.();
    // Deixa o laço do coalesce andar até a próxima espera.
    await new Promise((r) => setTimeout(r, 0));
  };
  return {
    tarefa,
    soltar,
    get rodadas() {
      return rodadas;
    },
    get maxEmVoo() {
      return maxEmVoo;
    },
  };
}

describe("coalesce", () => {
  test("parada, roda na hora", async () => {
    const t = controlada();
    const pedir = coalesce(t.tarefa);
    const fim = pedir();
    assert.equal(t.rodadas, 1);
    await t.soltar();
    await fim;
    assert.equal(t.rodadas, 1);
  });

  test("rajada durante uma leitura vira uma leitura a mais, nunca em paralelo", async () => {
    const t = controlada();
    const pedir = coalesce(t.tarefa);
    const primeiro = pedir();
    for (let i = 0; i < 5; i++) void pedir();
    assert.equal(t.rodadas, 1, "nenhuma leitura nova enquanto a primeira voa");
    await t.soltar();
    assert.equal(t.rodadas, 2, "uma, e só uma, releitura depois");
    await t.soltar();
    await primeiro;
    assert.equal(t.rodadas, 2);
    assert.equal(t.maxEmVoo, 1);
  });

  test("quem pede durante a leitura espera a releitura que o inclui", async () => {
    const t = controlada();
    const pedir = coalesce(t.tarefa);
    void pedir();
    let resolveu = false;
    const segundo = pedir().then(() => {
      resolveu = true;
    });
    await t.soltar();
    assert.equal(resolveu, false, "a primeira leitura começou antes do pedido");
    await t.soltar();
    await segundo;
    assert.equal(resolveu, true);
  });

  test("falha de uma rodada não trava as próximas", async () => {
    let rodadas = 0;
    const pedir = coalesce(async () => {
      rodadas++;
      if (rodadas === 1) throw new Error("rede");
    });
    await pedir();
    await pedir();
    assert.equal(rodadas, 2);
  });
});

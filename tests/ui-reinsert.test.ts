import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { reinsert } from "../src/lib/ui/reinsert";

const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join(",");
const of = (s: string) => s.split(",").map((id) => ({ id }));

describe("desfazer a exclusão sem voltar ao retrato", () => {
  test("cada item volta ao lugar onde estava", () => {
    const before = of("a,b,c,d,e");
    const current = of("a,c,e");
    assert.equal(ids(reinsert(current, before, of("b,d"))), "a,b,c,d,e");
  });

  test("não ressuscita o que saiu depois por outro caminho", () => {
    const before = of("a,b,c,d");
    // "b" foi excluída e desfeita; "c" saiu de vez nesse meio tempo.
    const current = of("a,d");
    assert.equal(ids(reinsert(current, before, of("b"))), "a,b,d");
  });

  test("mantém o que chegou depois do retrato", () => {
    const before = of("a,b,c");
    const current = of("novo,a,c");
    assert.equal(ids(reinsert(current, before, of("b"))), "novo,a,b,c");
  });

  test("sem vizinho anterior na lista, volta para o topo", () => {
    const before = of("a,b,c");
    const current = of("c");
    assert.equal(ids(reinsert(current, before, of("b,a"))), "a,b,c");
  });

  test("item que já está na lista não duplica", () => {
    const before = of("a,b");
    const current = of("a,b");
    assert.equal(ids(reinsert(current, before, of("b"))), "a,b");
  });

  test("devolve o item como estava no retrato e mantém a versão atual dos outros", () => {
    const before = [{ id: "a", v: 1 }, { id: "b", v: 1 }];
    const current = [{ id: "a", v: 2 }];
    const out = reinsert(current, before, [before[1]]);
    assert.deepEqual(out, [{ id: "a", v: 2 }, { id: "b", v: 1 }]);
  });
});

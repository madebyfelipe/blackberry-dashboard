import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { DEFAULT_NEXT, safeNext } from "../src/lib/auth/next-path";

describe("destino do login (?next=)", () => {
  test("mantém o caminho interno, com busca e âncora", () => {
    assert.equal(safeNext("/clientes/c05?aba=financeiro"), "/clientes/c05?aba=financeiro");
    assert.equal(safeNext("/tarefas#t1"), "/tarefas#t1");
    assert.equal(safeNext("/inbox"), "/inbox");
  });

  test("sem valor ou relativo cai no padrão", () => {
    assert.equal(safeNext(null), DEFAULT_NEXT);
    assert.equal(safeNext(""), DEFAULT_NEXT);
    assert.equal(safeNext("tarefas"), DEFAULT_NEXT);
  });

  /*
   * Os valores como o `useSearchParams` entrega, já decodificados:
   * `?next=/%09/evil.com` chega aqui como "/\t/evil.com".
   */
  test("recusa tudo que o navegador resolveria para outra origem", () => {
    for (const ataque of [
      "/\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "//evil.com",
      "\\\\evil.com",
      "/\\/evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      " //evil.com",
    ]) {
      assert.equal(safeNext(ataque), DEFAULT_NEXT, JSON.stringify(ataque));
    }
  });

  test("o valor ainda codificado fica preso na origem do app", () => {
    // Se chegar sem decodificar, o `%09` é só um trecho do caminho.
    const destino = safeNext("/%09/evil.com");
    assert.ok(destino.startsWith("/") && !destino.startsWith("//"), destino);
    assert.equal(new URL(destino, "https://blackberry.app").origin, "https://blackberry.app");
  });
});

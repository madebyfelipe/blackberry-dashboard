import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test, { describe } from "node:test";

import { PIECE_STATUS } from "../src/lib/approval/constants";
import { STATUSES } from "../src/lib/tasks/constants";
import { CLIENT_STATUSES } from "../src/lib/clients/constants";

/*
 * As cores que as réguas de status carregam vão direto para `style` das pílulas
 * e dos selos. Elas já foram hex cravados no código, e o custo disso só aparece
 * tarde: um cinza muda no design e sobra um sozinho em algum canto. Este teste
 * prende as duas pontas — só token, e token que existe de verdade no `@theme`.
 */

const css = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

function tokensOf(value: string): string[] {
  return [...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
}

const cores: [string, string][] = [
  ...STATUSES.flatMap((s): [string, string][] => [
    [`status ${s.id} · ponto`, s.dot],
    [`status ${s.id} · selo`, s.badgeFg],
  ]),
  ...CLIENT_STATUSES.flatMap((s): [string, string][] => [
    [`cliente ${s.id} · fundo`, s.badgeBg],
    [`cliente ${s.id} · texto`, s.badgeFg],
  ]),
  ...Object.values(PIECE_STATUS).flatMap((p): [string, string][] => [
    [`peça ${p.id} · fundo`, p.badgeBg],
    [`peça ${p.id} · texto`, p.badgeFg],
    [`peça ${p.id} · ponto`, p.dot],
  ]),
];

describe("cores das réguas de status", () => {
  test("nenhuma cor é hex cru — todas são token", () => {
    for (const [onde, valor] of cores) {
      assert.equal(
        valor.includes("#"),
        false,
        `${onde} devia usar um token de globals.css, veio "${valor}"`,
      );
      assert.equal(
        tokensOf(valor).length,
        1,
        `${onde} devia ser um var(--token), veio "${valor}"`,
      );
    }
  });

  test("todo token usado está declarado no @theme", () => {
    for (const [onde, valor] of cores) {
      for (const token of tokensOf(valor)) {
        assert.ok(
          new RegExp(`^\\s*${token}:`, "m").test(css),
          `${onde} usa ${token}, que não existe em globals.css`,
        );
      }
    }
  });
});

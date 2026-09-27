import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { verifyPassword } from "../src/lib/auth/password";
import {
  DEMO_PASSWORD_AUSENTE,
  DEMO_PASSWORD_MIN,
  DEV_DEMO_PASSWORD,
  demoPassword,
  seedUsers,
} from "../src/lib/auth/seed";

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv;

describe("senha da conta semeada", () => {
  test("fora de produção: DEMO_PASSWORD ou o padrão de desenvolvimento", () => {
    assert.equal(demoPassword(env({})), DEV_DEMO_PASSWORD);
    assert.equal(demoPassword(env({ NODE_ENV: "development" })), DEV_DEMO_PASSWORD);
    assert.equal(demoPassword(env({ NODE_ENV: "test", DEMO_PASSWORD: "outra" })), "outra");
  });

  // Issue #82: produção nunca cai na senha pública do README.
  test("em produção, sem DEMO_PASSWORD, recusa semear", () => {
    assert.throws(() => demoPassword(env({ NODE_ENV: "production" })), {
      message: DEMO_PASSWORD_AUSENTE,
    });
    assert.throws(() => demoPassword(env({ NODE_ENV: "production", DEMO_PASSWORD: "" })));
  });

  test("em produção, DEMO_PASSWORD curta (inclusive a pública) é recusada", () => {
    assert.ok(DEV_DEMO_PASSWORD.length < DEMO_PASSWORD_MIN);
    assert.throws(() =>
      demoPassword(env({ NODE_ENV: "production", DEMO_PASSWORD: DEV_DEMO_PASSWORD })),
    );
    assert.throws(() =>
      demoPassword(env({ NODE_ENV: "production", DEMO_PASSWORD: "x".repeat(DEMO_PASSWORD_MIN - 1) })),
    );
  });

  test("em produção, DEMO_PASSWORD com o tamanho mínimo vale", () => {
    const forte = "k3P9-vQ2m-Lx7w";
    assert.equal(demoPassword(env({ NODE_ENV: "production", DEMO_PASSWORD: forte })), forte);
  });

  test("seedUsers segue a regra do ambiente atual", async () => {
    const vars = process.env as Record<string, string | undefined>;
    const antes = { NODE_ENV: vars.NODE_ENV, DEMO_PASSWORD: vars.DEMO_PASSWORD };
    // Atribuir `undefined` a process.env grava o texto "undefined": apaga.
    const definir = (nome: keyof typeof antes, valor: string | undefined) => {
      if (valor === undefined) delete vars[nome];
      else vars[nome] = valor;
    };
    try {
      definir("NODE_ENV", "production");
      definir("DEMO_PASSWORD", undefined);
      assert.throws(() => seedUsers(), { message: DEMO_PASSWORD_AUSENTE });

      definir("DEMO_PASSWORD", "senha-de-producao-forte");
      const [conta] = seedUsers();
      assert.equal(await verifyPassword("senha-de-producao-forte", conta.passwordHash), true);
      assert.equal(await verifyPassword(DEV_DEMO_PASSWORD, conta.passwordHash), false);

      definir("NODE_ENV", "development");
      definir("DEMO_PASSWORD", undefined);
      const [dev] = seedUsers();
      assert.equal(await verifyPassword(DEV_DEMO_PASSWORD, dev.passwordHash), true);
    } finally {
      definir("NODE_ENV", antes.NODE_ENV);
      definir("DEMO_PASSWORD", antes.DEMO_PASSWORD);
    }
  });
});

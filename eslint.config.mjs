import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_hash` etc.: convenção de desestruturação para descartar um campo
      // de propósito (ex.: tirar a senha de `toPublic`) — não é variável
      // esquecida.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      /*
       * As duas regras do React Compiler abaixo pegam padrões usados de
       * propósito em várias telas do produto: sincronizar estado local com
       * uma prop que muda (formulário reabrindo com outro registro, campo
       * controlado ecoando o valor de fora) e ler `ref.current` fora de
       * efeito para medir posição de menu/toolbar. Nenhum dos casos é bug —
       * mudar todos exigiria reescrever esses componentes, não corrigir o
       * lint. Reavaliar se o projeto adotar o React Compiler de verdade.
       */
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "data/**",
    "*-export.html",
    // App de desktop: CommonJS do Electron, com a própria checagem
    // (`npm run check` dentro de `desktop/`).
    "desktop/**",
  ]),
]);

export default eslintConfig;

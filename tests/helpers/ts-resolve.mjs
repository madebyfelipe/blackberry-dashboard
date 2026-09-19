/*
 * Hook de resolução para os testes do `node --test`.
 *
 * O Node roda TypeScript direto (type stripping, a partir do v22.18), mas
 * resolve módulos como ESM puro: não conhece o atalho `@/…` do tsconfig nem
 * completa a extensão que o código-fonte omite (`./types` → `./types.ts`).
 * Este hook faz as duas coisas, para os testes importarem os módulos de
 * `src/` exatamente como o app os importa — sem bundler e sem build.
 */

const SRC = new URL("../../src/", import.meta.url);

const HAS_EXTENSION = /\.[a-zA-Z0-9]+$/;

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/store/json-file" → file:///…/src/lib/store/json-file
  const spec = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), SRC).href
    : specifier;

  const relative = spec.startsWith("./") || spec.startsWith("../");
  const absolute = spec.startsWith("file:");

  // Pacote de verdade (node:test, react…): caminho normal.
  if (!relative && !absolute) return nextResolve(spec, context);

  if (!HAS_EXTENSION.test(spec)) {
    for (const candidate of [`${spec}.ts`, `${spec}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // tenta o próximo
      }
    }
  }
  return nextResolve(spec, context);
}

/*
 * Troca o `@vercel/blob` pelo Blob de mentira de `fake-blob.ts` — para testar
 * o registro e a exclusão de mídia sem rede. Registrado pelo próprio teste
 * (`register()` antes de importar `media/store`), e só vale naquele processo.
 */
const FAKE = new URL("./fake-blob.ts", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@vercel/blob") return { url: FAKE, shortCircuit: true };
  return nextResolve(specifier, context);
}

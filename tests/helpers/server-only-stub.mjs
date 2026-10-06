/*
 * Substitui `server-only` nos testes (ver `ts-resolve.mjs`).
 *
 * O pacote de verdade só existe para o bundler do Next recusar um módulo
 * importado do lado do cliente — o `webpack` dele troca por este mesmo tipo
 * de stub por dentro, mesmo sem o pacote instalado. O `node --test` roda sem
 * bundler, então sem este desvio todo módulo do servidor com `import
 * "server-only"` no topo (automation.ts, dispatch.ts…) falhava a resolver.
 * Nos testes é sempre o lado do servidor — não há nada para recusar.
 */
export {};

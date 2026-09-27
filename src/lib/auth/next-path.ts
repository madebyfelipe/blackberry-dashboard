/*
 * Para onde o login leva a pessoa depois de entrar (`?next=`, posto pelo
 * proxy). Só vale caminho deste próprio app: sem isso, um link real do
 * black berry com `?next=/\evil.com` logava a vítima e a mandava para fora.
 *
 * Checar o prefixo da string não basta — o navegador trata `\` como `/` e
 * descarta tab e quebra de linha no meio da URL, então `/\evil.com` e
 * `/<tab>/evil.com` viram `//evil.com`. Por isso a regra resolve o valor como
 * o navegador resolveria e exige que a origem continue a do app; o que sai é o
 * caminho já normalizado, nunca o texto cru.
 *
 * Função pura, testada em `tests/auth-next-path.test.ts`.
 */

export const DEFAULT_NEXT = "/tarefas";

/*
 * Origem fictícia só para resolver o valor: o que importa é se o resultado
 * continua nela. Não depende de `location` (a página também renderiza no
 * servidor).
 */
const BASE = "https://app.invalid";

export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return DEFAULT_NEXT;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== BASE) return DEFAULT_NEXT;
  return url.pathname + url.search + url.hash;
}

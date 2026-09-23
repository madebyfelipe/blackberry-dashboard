/*
 * O @ de cada pessoa do time (`@felipe`, `@marina.d`).
 *
 * É o nome que se digita para mencionar e atribuir — no Inbox, nas tarefas,
 * nos comentários — então precisa ser **único dentro da agência** e caber no
 * teclado: minúsculas, números, ponto e sublinhado, sem acento. Duas agências
 * podem ter cada uma o seu `@ana`; dentro da mesma, a segunda vira `@ana2`.
 *
 * Tudo aqui é função pura (testada em `tests/inbox-handle.test.ts`). Quem
 * grava e confere a unicidade contra o arquivo é o `repository.ts`.
 */

export const HANDLE_MIN = 2;
export const HANDLE_MAX = 24;

const VALID = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

/** Tira o "@", acento e maiúscula, e troca o que não cabe por ponto. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, ".")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/[._]+$/, "");
}

/** O @ escrito pela pessoa está no formato? Devolve a mensagem de erro, ou `null`. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `O @ precisa de pelo menos ${HANDLE_MIN} caracteres.`;
  if (handle.length > HANDLE_MAX) return `O @ cabe em até ${HANDLE_MAX} caracteres.`;
  if (!VALID.test(handle)) {
    return "Use letras minúsculas, números, ponto ou sublinhado — sem começar ou terminar com eles.";
  }
  return null;
}

/**
 * O @ que nasce do nome: o primeiro nome, e o sobrenome só se o primeiro já
 * estiver em uso ("Rodrigo Q." → `@rodrigo`, e o segundo Rodrigo → `@rodrigo.q`).
 * Esgotadas as duas formas, número no fim.
 */
export function suggestHandle(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const words = normalizeHandle(name).split(".").filter(Boolean);
  const first = words[0] && words[0].length >= HANDLE_MIN ? words[0] : "pessoa";
  const candidates = [first];
  if (words.length > 1) candidates.push(normalizeHandle(`${first}.${words[1]}`));
  for (const c of candidates) if (!handleProblem(c) && !used.has(c)) return c;
  for (let n = 2; ; n++) {
    const c = `${first.slice(0, HANDLE_MAX - String(n).length)}${n}`;
    if (!used.has(c)) return c;
  }
}

/**
 * As menções de um texto, na ordem em que aparecem e sem repetição. Só conta
 * o @ que começa palavra — o do e-mail (`ana@studio.com`) não é menção.
 */
export function mentionsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(^|[^a-z0-9._@])@([a-z0-9](?:[a-z0-9._]*[a-z0-9])?)/gi)) {
    const handle = m[2].toLowerCase();
    if (!out.includes(handle)) out.push(handle);
  }
  return out;
}

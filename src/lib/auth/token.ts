/*
 * Token de sessão — assinado com HMAC-SHA256 pela Web Crypto (`globalThis
 * .crypto.subtle`), que existe tanto no Node quanto no runtime do `proxy.ts`.
 * Por isso este arquivo não importa nada do Node nem do Next: ele é o único
 * pedaço de auth que roda dos dois lados.
 *
 * Formato: "<payload base64url>.<assinatura base64url>", payload = {sub, exp,
 * pv}. O token é opaco para o cliente (cookie httpOnly) e não guarda nada
 * sensível.
 *
 * `pv` é a versão da senha de quem entrou. Quem confere (session.ts) compara
 * com a versão gravada no usuário: trocar a senha sobe a versão e, com isso,
 * todo token emitido antes deixa de valer — é o que dá "sair de todos os
 * aparelhos" sem manter uma lista de sessões abertas.
 */

export const SESSION_COOKIE = "bb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

type Payload = { sub: string; exp: number; pv?: number };

/** O que o token carrega, já conferido. */
export type SessionClaims = { sub: string; passwordVersion: number };

/**
 * Tokens emitidos antes de existir `pv` não têm o campo. Tratá-los como
 * versão 1 (a inicial de todo usuário) mantém as sessões válidas na subida
 * desta mudança, em vez de deslogar todo mundo de uma vez.
 */
const PRIMEIRA_VERSAO = 1;

/**
 * O que se diz a quem subiu produção sem o segredo. É uma mensagem só, usada
 * tanto na recusa do boot (`src/instrumentation.ts`) quanto na de runtime
 * aqui, para que o erro no log seja sempre o mesmo texto — com o passo a
 * passo, e não só o nome da variável.
 */
export const AUTH_SECRET_AUSENTE = [
  "AUTH_SECRET não está definida (ou tem menos de 16 caracteres).",
  "Sem ela o cookie de sessão seria assinado com o segredo de desenvolvimento",
  "que está no repositório — qualquer um que leia o código entraria como",
  "qualquer usuário. Por isso o app recusa rodar em produção.",
  "",
  "Gere um segredo:   openssl rand -base64 32",
  "E defina:          Vercel → Settings → Environment Variables → AUTH_SECRET",
].join("\n");

/**
 * Segredo de assinatura. Em produção vem de AUTH_SECRET; fora dela, o app cai
 * num segredo de desenvolvimento — que não protege nada e invalida as sessões
 * a cada deploy, por isso em produção o caminho é recusar, não cair.
 */
function secret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  exigirSegredoEmProducao();
  return "black-berry-dev-secret-trocar-em-producao";
}

export function isProductionSecretMissing(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    !(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16)
  );
}

/**
 * Lança em produção sem segredo. Chamada no começo de `signSession` e de
 * `readSession`, **fora** do try/catch que existe ali: dentro dele o erro
 * viraria "token inválido" (null) e a falha sumiria num redirect para o login
 * — exatamente o silêncio que esta issue veio acabar.
 *
 * É a única barreira que vale nos dois runtimes: `token.ts` também roda no
 * proxy (Edge), onde o boot do servidor Node não passa.
 */
export function exigirSegredoEmProducao(): void {
  if (isProductionSecretMissing()) throw new Error(AUTH_SECRET_AUSENTE);
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/*
 * Devolve um Uint8Array apoiado num ArrayBuffer "de verdade" (não
 * SharedArrayBuffer) — é o que a Web Crypto aceita como BufferSource.
 */
function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  userId: string,
  options: { passwordVersion?: number; maxAgeSeconds?: number } = {},
): Promise<string> {
  exigirSegredoEmProducao();
  const {
    passwordVersion = PRIMEIRA_VERSAO,
    maxAgeSeconds = SESSION_MAX_AGE,
  } = options;
  const payload: Payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    pv: passwordVersion,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(body),
  );
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Devolve o conteúdo do token, ou null se ele for inválido/expirado.
 *
 * Aqui só se confere assinatura e validade — a versão da senha volta como
 * está escrita, porque conferi-la exige ler o usuário, e este arquivo não
 * pode tocar no store (roda também no `proxy.ts`).
 */
export async function readSession(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  exigirSegredoEmProducao();
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromB64url(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromB64url(body)),
    ) as Payload;
    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return {
      sub: payload.sub,
      passwordVersion:
        typeof payload.pv === "number" ? payload.pv : PRIMEIRA_VERSAO,
    };
  } catch {
    return null;
  }
}

/**
 * Só o id do usuário. É o que o `proxy.ts` precisa para decidir se deixa a
 * tela carregar; a conferência da versão da senha fica em `session.ts`, que
 * tem acesso ao store — e é por onde passam todas as rotas de API e o layout
 * do shell.
 */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  return (await readSession(token))?.sub ?? null;
}

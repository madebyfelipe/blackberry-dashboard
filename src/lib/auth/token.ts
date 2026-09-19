/*
 * Token de sessão — assinado com HMAC-SHA256 pela Web Crypto (`globalThis
 * .crypto.subtle`), que existe tanto no Node quanto no runtime do `proxy.ts`.
 * Por isso este arquivo não importa nada do Node nem do Next: ele é o único
 * pedaço de auth que roda dos dois lados.
 *
 * Formato: "<payload base64url>.<assinatura base64url>", payload = {sub, exp}.
 * O token é opaco para o cliente (cookie httpOnly) e não guarda nada sensível.
 */

export const SESSION_COOKIE = "bb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

type Payload = { sub: string; exp: number };

/**
 * Segredo de assinatura. Em produção vem de AUTH_SECRET; sem ele, o app cai
 * num segredo de desenvolvimento — o que invalida as sessões a cada deploy e
 * NÃO serve para produção (ver README).
 */
function secret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  return "black-berry-dev-secret-trocar-em-producao";
}

export function isProductionSecretMissing(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    !(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16)
  );
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
  maxAgeSeconds = SESSION_MAX_AGE,
): Promise<string> {
  const payload: Payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(body),
  );
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** Devolve o id do usuário, ou null se o token for inválido/expirado. */
export async function verifySession(
  token: string | undefined | null,
): Promise<string | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
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
    return payload.sub;
  } catch {
    return null;
  }
}

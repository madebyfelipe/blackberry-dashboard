import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPasswordVersion, getUserForSession } from "./repository";
import { SESSION_COOKIE, SESSION_MAX_AGE, readSession, signSession } from "./token";
import type { PublicUser } from "./types";

/*
 * Sessão do lado do servidor (Server Components e Route Handlers).
 * O `proxy.ts` NÃO importa este arquivo — lá só vale `token.ts`, que não
 * depende de `next/headers`.
 */

/**
 * Começa (ou renova) a sessão. O token leva a versão da senha do momento —
 * é ela que faz uma troca de senha derrubar os outros aparelhos.
 */
export async function startSession(userId: string): Promise<void> {
  const token = await signSession(userId, {
    passwordVersion: await getPasswordVersion(userId),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Usuário logado, ou undefined. Nunca lança.
 *
 * Além da assinatura do token (conferida em `token.ts`), aqui se confere a
 * versão da senha contra a que está gravada no usuário — um token emitido
 * antes da última troca de senha não vale mais.
 */
export async function currentUser(): Promise<PublicUser | undefined> {
  const store = await cookies();
  const claims = await readSession(store.get(SESSION_COOKIE)?.value);
  if (!claims) return undefined;
  return getUserForSession(claims.sub, claims.passwordVersion);
}

/**
 * Para rotas de API que exigem login. Devolve o usuário ou `null` — quem
 * chama responde com `unauthorized()`.
 *
 * O `proxy.ts` barra as telas, mas não as rotas de API (o matcher deixa
 * `/api` de fora de propósito: `/api/approve/<token>` e `/api/media/<id>`
 * são públicas por desenho). Então cada rota da agência checa aqui.
 */
export async function requireUser(): Promise<PublicUser | null> {
  return (await currentUser()) ?? null;
}

/** Resposta padrão para quem chamou a API sem sessão. */
export function unauthorized(message = "Faça login para continuar."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { agencyScope } from "@/lib/agency/id";
import type { AgencyScope } from "@/lib/agency/types";
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

/** Sessão e o tenant dela — o par que toda rota da agência precisa. */
export type AgencySession = { user: PublicUser; scope: AgencyScope };

/**
 * Sessão + escopo da agência.
 *
 * Este é o único lugar de onde um `AgencyScope` nasce em runtime, e é de
 * propósito: os `repository` exigem o escopo como primeiro argumento, então
 * quem quiser ler ou gravar dado de outra agência teria que forjar um
 * `AgencyId` na mão — não existe caminho a partir de query, corpo ou header.
 *
 * O usuário vem junto porque rota costuma precisar dos dois: o escopo para o
 * repository filtrar e o usuário para o que é do dono (o criador da tarefa,
 * por exemplo).
 */
export async function requireAgency(): Promise<AgencySession | null> {
  const user = await currentUser();
  return user ? { user, scope: agencyScope(user) } : null;
}

/** O mesmo escopo, para as telas do shell (Server Components). */
export async function currentAgencyScope(): Promise<AgencyScope | undefined> {
  const user = await currentUser();
  return user && agencyScope(user);
}

/** Resposta padrão para quem chamou a API sem sessão. */
export function unauthorized(message = "Faça login para continuar."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

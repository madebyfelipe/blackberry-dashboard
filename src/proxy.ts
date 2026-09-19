import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/*
 * Porteiro do shell autenticado (Next 16: `proxy.ts`, ex-`middleware.ts`).
 *
 * Só depende de `token.ts` — nada de `next/headers`, banco ou store: o proxy
 * roda antes da renderização e pode ser servido fora do runtime do app.
 *
 * O que NÃO passa por aqui: `/a/<token>` (aprovação pública do cliente, que é
 * justamente sem login) e as rotas de auth.
 */

/** Telas que exigem sessão. */
const PROTECTED = [
  "/inbox",
  "/tarefas",
  "/social",
  "/clientes",
  "/equipe",
  "/configuracoes",
];

const AUTH_PAGES = ["/login", "/criar-conta", "/recuperar-senha"];

/**
 * Marca que o layout do shell põe na URL ao mandar a pessoa para o login
 * porque a sessão foi recusada lá dentro (ver o uso abaixo).
 */
const SESSAO_ENCERRADA = { chave: "sessao", valor: "encerrada" };

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isProtected && !userId) {
    const url = new URL("/login", request.url);
    // Volta para onde a pessoa queria ir depois de entrar.
    url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    // Cookie inválido/expirado não deve sobrar e gerar novo redirect depois.
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Já logado não precisa ver login/cadastro.
  if (userId && AUTH_PAGES.includes(pathname)) {
    /*
     * Exceção: o proxy só sabe conferir a assinatura do token. Quem decide se
     * a sessão ainda vale é o `session.ts`, que lê o usuário — e hoje recusa
     * token anterior à última troca de senha. Sem esta saída, um cookie bem
     * assinado mas morto entraria em laço: o layout manda para /login, o proxy
     * vê assinatura válida e devolve para /tarefas, o layout manda de novo…
     */
    if (request.nextUrl.searchParams.get(SESSAO_ENCERRADA.chave) === SESSAO_ENCERRADA.valor) {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    return NextResponse.redirect(new URL("/tarefas", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Sem matcher, o proxy rodaria também em `_next/static`, imagens e assets —
   * e bloquearia CSS/JS. Este padrão deixa de fora tudo que não é rota de tela.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};

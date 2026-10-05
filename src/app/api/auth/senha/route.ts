import { NextResponse } from "next/server";
import { AuthError, changePassword } from "@/lib/auth/repository";
import { requireUser, startSession } from "@/lib/auth/session";
import { createAttempts } from "@/lib/auth/attempts";

export const dynamic = "force-dynamic";

/*
 * Sem freio, quem tivesse o cookie de sessão (roubado, ou um aparelho
 * destrancado) testava a senha atual sem limite — e ainda trancava a dona de
 * verdade, porque trocar a senha derruba as outras sessões (issue #108). A
 * chave é só a conta: quem pede já está autenticado, então o IP não ajuda a
 * segmentar o ataque.
 */
const attempts = createAttempts();

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { currentPassword, nextPassword } = (body ?? {}) as Record<string, unknown>;

  // Reserva antes de conferir a senha atual — mesmo cuidado do login contra
  // requisições em paralelo.
  const wait = attempts.reserve(user.id);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }
  try {
    await changePassword(
      user.id,
      String(currentPassword ?? ""),
      String(nextPassword ?? ""),
    );
    attempts.succeed(user.id);
    /*
     * A troca de senha sobe a versão gravada no usuário, o que invalida todo
     * token emitido antes — inclusive o deste navegador. Reemitir o cookie
     * aqui mantém quem trocou a senha logado e derruba só os outros aparelhos,
     * que é o comportamento esperado.
     */
    await startSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Senha atual errada (ou nova senha fraca): a vaga reservada fica
    // contada, como no login.
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    attempts.release(user.id);
    throw err;
  }
}

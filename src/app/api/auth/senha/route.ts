import { NextResponse } from "next/server";
import { AuthError, changePassword } from "@/lib/auth/repository";
import { requireUser, startSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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
  try {
    await changePassword(
      user.id,
      String(currentPassword ?? ""),
      String(nextPassword ?? ""),
    );
    /*
     * A troca de senha sobe a versão gravada no usuário, o que invalida todo
     * token emitido antes — inclusive o deste navegador. Reemitir o cookie
     * aqui mantém quem trocou a senha logado e derruba só os outros aparelhos,
     * que é o comportamento esperado.
     */
    await startSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

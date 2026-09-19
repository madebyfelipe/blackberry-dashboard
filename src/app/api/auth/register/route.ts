import { NextResponse } from "next/server";
import { AuthError, registerUser } from "@/lib/auth/repository";
import { startSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { name, email, password, agency, role } = (body ?? {}) as Record<
    string,
    unknown
  >;
  try {
    const user = await registerUser({
      name: String(name ?? ""),
      email: String(email ?? ""),
      password: String(password ?? ""),
      agency: agency === undefined ? undefined : String(agency),
      role: role as never,
    });
    // Cadastro já entra logado — é o comportamento esperado do "Criar conta".
    await startSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

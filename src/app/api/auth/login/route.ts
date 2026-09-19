import { NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth/repository";
import { startSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  try {
    const user = await authenticate({
      email: String(email ?? ""),
      password: String(password ?? ""),
    });
    await startSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

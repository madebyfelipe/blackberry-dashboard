import { NextResponse } from "next/server";
import { authenticate, AuthError } from "@/lib/auth/repository";
import { startSession } from "@/lib/auth/session";
import { attemptKey, createAttempts } from "@/lib/auth/attempts";

const attempts = createAttempts();

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip");
}

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  const key = attemptKey(String(email ?? ""), clientIp(req));
  const wait = attempts.blockedFor(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente de novo em ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }
  try {
    const user = await authenticate({
      email: String(email ?? ""),
      password: String(password ?? ""),
    });
    attempts.succeed(key);
    await startSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      attempts.fail(key);
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
}

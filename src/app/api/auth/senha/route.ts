import { NextResponse } from "next/server";
import { AuthError, changePassword } from "@/lib/auth/repository";
import { requireUser } from "@/lib/auth/session";

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
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

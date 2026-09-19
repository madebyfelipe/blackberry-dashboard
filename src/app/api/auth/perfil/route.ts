import { NextResponse } from "next/server";
import { AuthError, updateProfile } from "@/lib/auth/repository";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { name, agency } = (body ?? {}) as Record<string, unknown>;
  try {
    // Só o próprio dono edita o próprio perfil: o id vem da sessão.
    const updated = await updateProfile(user.id, {
      name: name === undefined ? undefined : String(name),
      agency: agency === undefined ? undefined : String(agency),
    });
    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

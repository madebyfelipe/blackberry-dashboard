import { NextResponse } from "next/server";
import { createBatch } from "@/lib/approval/repository";
import { requireAgency } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Cria um lote vazio — o "Novo lote" da lista de lotes do cliente.
 *
 * A agência vem da sessão, nunca do corpo: o lote nasce dentro do tenant de
 * quem está logado, e não de quem a requisição disser.
 */
export async function POST(req: Request) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para criar o lote." }, { status: 401 });
  }

  let body: { client?: string; title?: string; period?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const batch = await createBatch(session.scope, {
    client: String(body.client ?? ""),
    title: String(body.title ?? ""),
    period: body.period ? String(body.period) : undefined,
    description: body.description ? String(body.description) : undefined,
  });
  if (!batch) {
    return NextResponse.json(
      { error: "O lote precisa de um cliente e de um título." },
      { status: 422 },
    );
  }
  return NextResponse.json({ batch }, { status: 201 });
}

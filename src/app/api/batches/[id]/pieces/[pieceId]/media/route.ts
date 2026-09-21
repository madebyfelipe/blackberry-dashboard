import { NextResponse } from "next/server";
import { addPieceMedia, getBatch, removePieceMedia } from "@/lib/approval/repository";
import { MediaError, saveMedia } from "@/lib/media/store";
import { requireAgency } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; pieceId: string }> };

/** Acrescenta uma arte ao carrossel da peça. Multipart, campo `file`. */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para enviar artes." }, { status: 401 });
  }
  const { id, pieceId } = await params;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });

  // Dono antes dos bytes: arte de um lote que não é desta agência nem chega a
  // ser gravada.
  if (!(await getBatch(session.scope, id))) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = await saveMedia(bytes, { mime: file.type, name: file.name });
    const result = await addPieceMedia(session.scope, id, pieceId, media);
    if (!result) {
      return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}

/** Remove uma arte do carrossel da peça — `?mediaId=`. */
export async function DELETE(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para editar o lote." }, { status: 401 });
  }
  const { id, pieceId } = await params;
  const mediaId = new URL(req.url).searchParams.get("mediaId");
  if (!mediaId) {
    return NextResponse.json({ error: "Falta dizer qual arte remover." }, { status: 400 });
  }
  const result = await removePieceMedia(session.scope, id, pieceId, mediaId);
  if (!result) {
    return NextResponse.json({ error: "Peça ou arte não encontrada." }, { status: 404 });
  }
  return NextResponse.json(result);
}

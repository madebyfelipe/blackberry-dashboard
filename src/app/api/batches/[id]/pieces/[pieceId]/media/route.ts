import { NextResponse } from "next/server";
import { addPieceMedia, getBatch, removePieceMedia } from "@/lib/approval/repository";
import { MediaError, saveBlobMedia, saveMedia } from "@/lib/media/store";
import { requireAgency } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; pieceId: string }> };

/**
 * Acrescenta uma arte ao carrossel da peça, por um de dois caminhos:
 *
 * - **JSON** `{ pathname, name }` — a arte já foi do navegador direto para o
 *   Vercel Blob (ver a rota `media/token`) e aqui ela só é registrada. É o
 *   caminho de produção: o arquivo não passa pela função, então não bate no
 *   corte de 4,5 MB que a Vercel aplica a corpo de requisição.
 * - **Multipart**, campo `file` — o arquivo vem por dentro da função, como
 *   sempre foi. Continua valendo onde não há Blob configurado (dev local),
 *   onde o disco é gravável e os arquivos são pequenos.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para enviar artes." }, { status: 401 });
  }
  const { id, pieceId } = await params;
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");

  let file: File | null = null;
  let blob: { pathname: string; name: string } | null = null;
  try {
    if (isJson) {
      const body = (await req.json()) as Record<string, unknown>;
      const pathname = typeof body?.pathname === "string" ? body.pathname : "";
      if (!pathname) {
        return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
      }
      blob = { pathname, name: typeof body?.name === "string" ? body.name : "" };
    } else {
      const form = await req.formData();
      const value = form.get("file");
      if (value instanceof File) file = value;
      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  // Dono antes dos bytes: arte de um lote que não é desta agência nem chega a
  // ser gravada.
  if (!(await getBatch(session.scope, id))) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
  }

  try {
    const media = blob
      ? await saveBlobMedia(blob)
      : await saveMedia(new Uint8Array(await file!.arrayBuffer()), {
          mime: file!.type,
          name: file!.name,
        });
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

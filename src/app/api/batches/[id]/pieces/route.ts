import { NextResponse } from "next/server";
import { addPiece, getBatch } from "@/lib/approval/repository";
import { MediaError, saveMedia } from "@/lib/media/store";
import { requireAgency } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/*
 * Cria peças no lote. Dois caminhos:
 *
 * - JSON (ou corpo vazio): uma peça vazia — o "Adicionar peça" do editor.
 * - multipart com um ou mais `files`: uma peça por arte enviada, já com nome,
 *   tamanho real e formato deduzidos do arquivo — é o "Subir artes".
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para editar o lote." }, { status: 401 });
  }
  const { id } = await params;
  const isUpload = (req.headers.get("content-type") ?? "").includes(
    "multipart/form-data",
  );

  if (!isUpload) {
    const piece = await addPiece(session.scope, id);
    if (!piece) {
      // Inclui o lote de outra agência: para esta sessão ele não existe.
      return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ piece }, { status: 201 });
  }

  let files: File[] = [];
  try {
    const form = await req.formData();
    files = form.getAll("files").filter((v): v is File => v instanceof File);
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  /*
   * Confere o dono antes de gravar o primeiro byte: sem isso, um lote de outra
   * agência recusaria a peça mas já teria deixado a arte no disco.
   */
  if (!(await getBatch(session.scope, id))) {
    return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  }

  const pieces = [];
  /*
   * Um arquivo recusado não derruba o lote inteiro: as artes válidas entram e
   * a resposta lista o que ficou de fora, com o motivo.
   */
  const rejected: { name: string; error: string }[] = [];

  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const media = await saveMedia(bytes, { mime: file.type, name: file.name });
      const piece = await addPiece(session.scope, id, media);
      if (!piece) {
        return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
      }
      pieces.push(piece);
    } catch (err) {
      if (err instanceof MediaError) {
        rejected.push({ name: file.name, error: err.message });
        continue;
      }
      throw err;
    }
  }

  if (pieces.length === 0) {
    return NextResponse.json(
      { error: rejected[0]?.error ?? "Nenhuma arte aceita.", rejected },
      { status: 422 },
    );
  }
  return NextResponse.json({ pieces, rejected }, { status: 201 });
}

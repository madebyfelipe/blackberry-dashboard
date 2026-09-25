import { NextResponse } from "next/server";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { getClient } from "@/lib/clients/repository";
import { ValidationError, addFile } from "@/lib/crm/repository";
import { isFileFolder } from "@/lib/crm/constants";
import type { FileFolder } from "@/lib/crm/types";
import { CLIENT_FILE_POLICY } from "@/lib/media/constants";
import { MediaError, deleteMedia, saveBlobMedia, saveMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * "Enviar arquivo" da aba Arquivos. Os dois caminhos das artes e dos anexos:
 * JSON `{ pathname, name, folder }` quando o arquivo já foi direto para o
 * Blob (produção), multipart `file` + `folder` sem Blob (dev local). Tipo e
 * tamanho vêm do armazenamento, nunca do navegador.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  const { id } = await params;
  if (!(await getClient(session.scope, id))) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  let media;
  let folder: FileFolder = "briefings";
  try {
    if (isJson) {
      const body = (await req.json()) as Record<string, unknown>;
      const pathname = typeof body?.pathname === "string" ? body.pathname : "";
      if (!pathname) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
      if (isFileFolder(body.folder)) folder = body.folder;
      media = await saveBlobMedia(
        { pathname, name: typeof body?.name === "string" ? body.name.slice(0, 160) : "" },
        CLIENT_FILE_POLICY,
      );
    } else {
      const form = await req.formData();
      const file = form.get("file");
      const f = form.get("folder");
      if (isFileFolder(f)) folder = f;
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
      }
      media = await saveMedia(
        new Uint8Array(await file.arrayBuffer()),
        { mime: file.type, name: file.name.slice(0, 160) },
        CLIENT_FILE_POLICY,
      );
    }
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof TypeError) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    throw err;
  }

  try {
    const account = await addFile(session.scope, id, {
      mediaId: media.id,
      name: media.name,
      mime: media.mime,
      size: media.size,
      folder,
      uploadedBy: session.user.name,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    // A ficha recusou (cheia): o arquivo que já subiu não pode ficar órfão.
    await deleteMedia(media.id).catch(() => undefined);
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

import { NextResponse } from "next/server";
import { ValidationError, moveFile, removeFile } from "@/lib/crm/repository";
import { isFileFolder } from "@/lib/crm/constants";
import { notFound, withClient } from "@/lib/crm/http";
import { deleteMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Mover o arquivo de pasta. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  return withClient(req, id, async ({ session, body }) => {
    if (!isFileFolder(body.folder)) throw new ValidationError("Pasta inválida.");
    const account = await moveFile(session.scope, id, fileId, body.folder);
    return account ? NextResponse.json({ account }) : notFound("Arquivo não encontrado.");
  });
}

/** Tira da ficha e apaga do armazenamento — nessa ordem: registro sem arquivo quebraria na tela. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  return withClient(
    req,
    id,
    async ({ session }) => {
      const out = await removeFile(session.scope, id, fileId);
      if (!out) return notFound("Arquivo não encontrado.");
      await deleteMedia(out.mediaId).catch(() => undefined);
      return NextResponse.json({ account: out.account });
    },
    { body: false },
  );
}

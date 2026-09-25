import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { requireAgency, unauthorized } from "@/lib/auth/session";
import { getClient } from "@/lib/clients/repository";
import { CLIENT_FILE_POLICY, isMediaBlobPathname } from "@/lib/media/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/*
 * Token de upload direto para o Vercel Blob — o mesmo caminho das artes do
 * lote e dos anexos do Inbox (ver "O teto de 4,5 MB" no README), com as
 * regras da ficha: cliente desta agência, pasta `clientes/`, os tipos do
 * anexo e 50 MB. O Blob passa a impor tipo e tamanho por conta própria.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) return unauthorized();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Envio direto indisponível: o Blob não está configurado." },
      { status: 503 },
    );
  }
  const { id } = await params;
  if (!(await getClient(session.scope, id))) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request: req,
      body: body as Parameters<typeof handleUpload>[0]["body"],
      onBeforeGenerateToken: async (pathname) => {
        if (!isMediaBlobPathname(pathname, CLIENT_FILE_POLICY.prefix)) {
          throw new Error("Caminho de arquivo inválido.");
        }
        return {
          allowedContentTypes: Object.keys(CLIENT_FILE_POLICY.accepted),
          maximumSizeInBytes: CLIENT_FILE_POLICY.maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao autorizar o envio." },
      { status: 400 },
    );
  }
}

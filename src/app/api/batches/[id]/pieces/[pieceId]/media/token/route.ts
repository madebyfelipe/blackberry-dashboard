import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { getBatch } from "@/lib/approval/repository";
import { requireAgency } from "@/lib/auth/session";
import {
  ACCEPTED_MIME,
  MAX_UPLOAD_BYTES,
  isMediaBlobPathname,
} from "@/lib/media/constants";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; pieceId: string }> };

/*
 * Token de upload direto para o Vercel Blob.
 *
 * O arquivo não passa por aqui — só a permissão de subi-lo. Esta é a única
 * porta, então é aqui que valem as regras: sessão, o lote ser desta agência,
 * o formato do pathname, e os limites que o Blob passa a impor por conta
 * própria (`allowedContentTypes`, `maximumSizeInBytes`). Quem tem o token só
 * consegue gravar um arquivo aceito, do tamanho permitido, dentro de
 * `media/` — e por pouco tempo.
 *
 * Nada de `onUploadCompleted`: a Vercel não consegue chamar de volta um
 * `localhost`, então registrar a arte por aí faria o dev local se comportar
 * diferente da produção — que é exatamente o tipo de diferença que deixou o
 * 413 passar batido. Quem registra é o navegador, no `POST` da rota de mídia,
 * depois que o upload termina.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await requireAgency();
  if (!session) {
    return NextResponse.json({ error: "Faça login para enviar artes." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Envio direto indisponível: o Blob não está configurado." },
      { status: 503 },
    );
  }

  const { id, pieceId } = await params;
  const batch = await getBatch(session.scope, id);
  if (!batch?.pieces.some((p) => p.id === pieceId)) {
    return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
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
        if (!isMediaBlobPathname(pathname)) {
          throw new Error("Caminho de arte inválido.");
        }
        return {
          allowedContentTypes: Object.keys(ACCEPTED_MIME),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          // Sufixo do lado do Blob: dois arquivos de mesmo nome não se
          // sobrescrevem, e o navegador não escolhe o caminho final.
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

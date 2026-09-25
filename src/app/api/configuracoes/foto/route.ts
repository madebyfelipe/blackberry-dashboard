import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { updateMyProfile } from "@/lib/inbox/repository";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { PROFILE_IMAGE_POLICY } from "@/lib/media/constants";
import { MediaError, deleteMedia, saveMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

/*
 * A foto de perfil. Imagem de até 2 MB, pela rota (cabe no corpo da Vercel,
 * sem precisar do envio direto ao Blob). A foto antiga sai quando a nova
 * entra — o id da mídia não é reaproveitado, então não há o que atualizar.
 *
 * O registro nasce com dono (a agência e a pessoa) e com uma "mensagem" que
 * não existe: assim ele nunca passa como anexo de conversa
 * (`resolveAttachments` recusa mídia que já tem mensagem) e a faxina de
 * "Excluir agência" o encontra pelo dono.
 */

function mediaIdOf(url: string | null): string | null {
  return url?.match(/^\/api\/media\/([a-f0-9]{32})$/)?.[1] ?? null;
}

export async function POST(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }
    const media = await saveMedia(
      new Uint8Array(await file.arrayBuffer()),
      {
        mime: file.type,
        name: file.name.slice(0, 160),
        owner: {
          agencyId: session.scope.agencyId,
          uploaderId: session.me.id,
          conversationId: "__perfil__",
          messageId: "__perfil__",
        },
      },
      PROFILE_IMAGE_POLICY,
    );
    const previous = mediaIdOf(session.me.photoUrl);
    const me = await updateMyProfile(session.scope, session.me.id, { photoUrl: media.url });
    if (previous) await deleteMedia(previous).catch(() => undefined);
    return NextResponse.json({ me }, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof TypeError) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    throw err;
  }
}

export async function DELETE() {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const previous = mediaIdOf(session.me.photoUrl);
  const me = await updateMyProfile(session.scope, session.me.id, { photoUrl: null });
  if (previous) await deleteMedia(previous).catch(() => undefined);
  return NextResponse.json({ me });
}

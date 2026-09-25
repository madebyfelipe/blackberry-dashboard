import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { getAgencySettings, updateAgencySettings } from "@/lib/agency/repository";
import { canManageTeam } from "@/lib/inbox/users";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { PROFILE_IMAGE_POLICY } from "@/lib/media/constants";
import { MediaError, deleteMedia, saveMedia } from "@/lib/media/store";

export const dynamic = "force-dynamic";

/*
 * O logo da agência — mesma régua da foto de perfil (PNG, JPG ou WebP, até
 * 2 MB, sem SVG). Aparece na barra lateral e no link de aprovação do
 * cliente, que é público: o id longo da mídia é o que protege, como nas artes.
 */

function mediaIdOf(url: string | null): string | null {
  return url?.match(/^\/api\/media\/([a-f0-9]{32})$/)?.[1] ?? null;
}

async function managerSession() {
  const session = await currentInboxSession();
  if (!session) return { error: unauthorized() };
  if (!canManageTeam(session.me)) {
    return { error: NextResponse.json({ error: "Só Admin e Gerente mudam a agência." }, { status: 403 }) };
  }
  return { session };
}

export async function POST(req: Request) {
  const { session, error } = await managerSession();
  if (!session) return error;
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
          conversationId: "__agencia__",
          messageId: "__agencia__",
        },
      },
      PROFILE_IMAGE_POLICY,
    );
    const previous = mediaIdOf((await getAgencySettings(session.scope)).logoUrl);
    const settings = await updateAgencySettings(session.scope, { logoUrl: media.url });
    if (previous) await deleteMedia(previous).catch(() => undefined);
    return NextResponse.json({ logoUrl: settings.logoUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof TypeError) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
    throw err;
  }
}

export async function DELETE() {
  const { session, error } = await managerSession();
  if (!session) return error;
  const previous = mediaIdOf((await getAgencySettings(session.scope)).logoUrl);
  await updateAgencySettings(session.scope, { logoUrl: null });
  if (previous) await deleteMedia(previous).catch(() => undefined);
  return NextResponse.json({ logoUrl: null });
}

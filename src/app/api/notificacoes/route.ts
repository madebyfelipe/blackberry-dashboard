import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/auth/session";
import { currentInboxSession } from "@/lib/inbox/viewer";
import { listNotifications, markNotifications } from "@/lib/notifications/repository";
import { unreadTotal } from "@/lib/notifications/view";

export const dynamic = "force-dynamic";

/**
 * As suas notificações — de quem está logado, e de mais ninguém: o
 * destinatário sai da sessão, não da requisição. `?resumo=1` devolve só as
 * não lidas mais recentes (a lateral e o aviso por releitura usam isso).
 */
export async function GET(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  const all = await listNotifications(session.scope, session.me.id);
  const unread = unreadTotal(all);
  if (new URL(req.url).searchParams.get("resumo")) {
    return NextResponse.json({ unread, latest: all.filter((n) => !n.readAt).slice(0, 20) });
  }
  return NextResponse.json({ unread, notifications: all });
}

/**
 * Marca como lidas (`read: false` desfaz): por id, todas (`all`) ou as de uma
 * tarefa/conversa (`ref`).
 */
export async function PATCH(req: Request) {
  const session = await currentInboxSession();
  if (!session) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 500) : undefined;
  const ref = typeof body.ref === "string" ? body.ref : undefined;
  const all = body.all === true;
  if (!ids?.length && !ref && !all) {
    return NextResponse.json({ error: "Diga quais notificações marcar." }, { status: 400 });
  }
  const changed = await markNotifications(
    session.scope,
    session.me.id,
    { ids, ref, all },
    body.read !== false,
  );
  return NextResponse.json({ changed });
}

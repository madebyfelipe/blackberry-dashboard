import type { InboxMember } from "@/lib/inbox/types";
import { canManageTeam } from "@/lib/inbox/users";

/*
 * A linha da tela de Usuários como o navegador a recebe. O token do convite
 * só viaja para quem administra o time — é ele que coloca alguém dentro da
 * agência, então não pode aparecer na tela de um Editor.
 */
export type UserRow = Pick<
  InboxMember,
  "id" | "name" | "email" | "handle" | "role" | "status" | "lastSeenAt" | "createdAt"
> & {
  /** `/criar-conta?convite=…` — só para Admin e Gerente, só em convite pendente. */
  invitePath: string | null;
};

export function toUserRow(m: InboxMember, viewer: Pick<InboxMember, "role">): UserRow {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    handle: m.handle,
    role: m.role,
    status: m.status,
    lastSeenAt: m.lastSeenAt,
    createdAt: m.createdAt,
    invitePath:
      m.status === "convite" && m.invite && canManageTeam(viewer)
        ? `/criar-conta?convite=${m.invite.token}`
        : null,
  };
}

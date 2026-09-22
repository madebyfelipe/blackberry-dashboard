import { requireAgency, type AgencySession } from "@/lib/auth/session";
import { ensureMember } from "./repository";
import type { InboxMember } from "./types";

/**
 * A sessão do Inbox: quem está logado, a agência dele e **o membro da equipe
 * que ele é**.
 *
 * Fica separado do `repository.ts` porque depende da sessão do servidor
 * (`next/headers`), e o repository não pode depender — é o mesmo cuidado que
 * mantém `auth/token.ts` sem Node nem Next para o `proxy.ts` poder usá-lo.
 *
 * `ensureMember` é o que registra quem entra pela primeira vez: enquanto não
 * existir convite de equipe, é assim que a agência ganha gente.
 */
export type InboxSession = AgencySession & { me: InboxMember };

export async function currentInboxSession(): Promise<InboxSession | null> {
  const session = await requireAgency();
  if (!session) return null;
  const me = await ensureMember(session.scope, {
    name: session.user.name,
    email: session.user.email,
  });
  return { ...session, me };
}

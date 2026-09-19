import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Raiz: quem já tem sessão cai direto no app; o resto, no login. */
export default async function RootPage() {
  const user = await currentUser();
  redirect(user ? "/tarefas" : "/login");
}

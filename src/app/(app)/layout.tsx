import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { CallProvider } from "@/components/inbox/CallProvider";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * O `proxy.ts` já barra quem não tem sessão. Esta checagem é o cinto de
   * segurança do lado do servidor: garante que nenhuma tela do shell seja
   * renderizada sem usuário, e é dela que sai o usuário da sidebar.
   *
   * Chegar aqui sem usuário com um cookie bem assinado significa sessão
   * recusada pelo `session.ts` — hoje, token anterior à última troca de senha.
   * A marca na URL avisa o proxy para apagar o cookie em vez de devolver a
   * pessoa para cá (ver `SESSAO_ENCERRADA` em `proxy.ts`).
   */
  const user = await currentUser();
  if (!user) redirect("/login?sessao=encerrada");

  /*
   * A conexão de tempo real envolve o shell inteiro, não só o Inbox: presença
   * é "esta pessoa está com o produto aberto", e quem está em Tarefas está
   * tão online quanto quem está na conversa. Sem `ABLY_API_KEY` o provedor
   * não conecta nada e todas as telas seguem como antes.
   */
  return (
    <RealtimeProvider>
      <CallProvider>
      <div className="flex h-screen flex-col gap-3 bg-bg p-3 md:flex-row md:gap-4 md:p-4">
        <Sidebar user={user} />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      </CallProvider>
    </RealtimeProvider>
  );
}

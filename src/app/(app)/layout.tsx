import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /*
   * O `proxy.ts` já barra quem não tem sessão. Esta checagem é o cinto de
   * segurança do lado do servidor: garante que nenhuma tela do shell seja
   * renderizada sem usuário, e é dela que sai o usuário da sidebar.
   */
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen gap-4 bg-bg p-4">
      <Sidebar user={user} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

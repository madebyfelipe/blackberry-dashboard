import { redirect } from "next/navigation";
import { accessOf, currentUser } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Acesso" };

/*
 * Para quem tem conta mas não pode usar a agência agora:
 * - chegou pelo convite automático do domínio e espera aprovação;
 * - foi arquivado (arquivar tira o acesso), ou o convite foi excluído ou não
 *   foi aceito pelo link (issue #72).
 * Quem pode entrar é devolvido ao app; sem sessão, ao login.
 */
export default async function AcessoPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const access = await accessOf(user);
  if (access === "ok") redirect("/tarefas");

  return (
    <AuthShell
      title={access === "aguardando" ? "Quase lá" : "Acesso encerrado"}
      subtitle={
        access === "aguardando"
          ? `Seu e-mail é do domínio da ${user.agency}, então você já tem um convite para o time. Falta um Admin ou Gerente aprovar sua entrada em Usuários.`
          : `Sua conta não tem acesso ao time da ${user.agency} — foi arquivada, ou o convite não vale mais. Se foi engano, fale com um Admin ou Gerente da agência.`
      }
    >
      <p className="text-[13px] text-muted">
        Conta: <span className="text-fg-soft">{user.email}</span>
      </p>
      <SignOutButton />
    </AuthShell>
  );
}

import { redirect } from "next/navigation";
import { listClients } from "@/lib/clients/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { ClientsView } from "@/components/clients/ClientsView";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  // A tela lê só os clientes da agência da sessão. O layout já barra quem não
  // tem sessão; este redirect existe porque sem escopo não há o que listar.
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");
  const clients = await listClients(scope);
  return <ClientsView initialClients={clients} />;
}

import { redirect } from "next/navigation";
import { listBatches } from "@/lib/approval/repository";
import { listClientSummaries } from "@/lib/approval/clients";
import { currentAgencyScope } from "@/lib/auth/session";
import { ClientsView } from "@/components/approval/ClientsView";

export const dynamic = "force-dynamic";

/** Social media, passo 1: de quem são os lotes (export "Clínica Aurora - Clientes"). */
export default async function SocialPage() {
  // Só os lotes da agência da sessão chegam à tela.
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");

  return <ClientsView clients={listClientSummaries(await listBatches(scope))} />;
}

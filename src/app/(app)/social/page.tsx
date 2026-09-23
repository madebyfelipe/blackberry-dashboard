import { redirect } from "next/navigation";
import { listBatches } from "@/lib/approval/repository";
import { listClientSummaries } from "@/lib/approval/clients";
import { listClients } from "@/lib/clients/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { ClientsView } from "@/components/approval/ClientsView";

export const dynamic = "force-dynamic";

/** Social media, passo 1: de quem são os lotes (export "Clínica Aurora - Clientes"). */
export default async function SocialPage() {
  // Só os lotes da agência da sessão chegam à tela.
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");

  // A lista é a de Clientes (cadastro único), com os lotes de cada um por cima.
  const [batches, clients] = await Promise.all([listBatches(scope), listClients(scope)]);
  return (
    <ClientsView
      clients={listClientSummaries(
        batches,
        clients.map((c) => c.name),
      )}
    />
  );
}

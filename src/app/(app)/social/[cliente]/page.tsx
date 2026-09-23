import { notFound, redirect } from "next/navigation";
import { redirectWithoutScope } from "@/lib/auth/session";
import { listBatches } from "@/lib/approval/repository";
import {
  batchesOfClient,
  clientNameFromSlug,
  slugify,
} from "@/lib/approval/clients";
import { currentAgencyScope } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/repository";
import { BatchesView } from "@/components/approval/BatchesView";

export const dynamic = "force-dynamic";

/** Social media, passo 2: os lotes de um cliente (export "Lotes de Aprovação"). */
export default async function ClientBatchesPage({
  params,
}: {
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  const scope = await currentAgencyScope();
  if (!scope) return redirectWithoutScope();

  const [all, registered] = await Promise.all([listBatches(scope), listClients(scope)]);
  // Cliente da lista de Clientes abre mesmo sem lote — é onde nasce o primeiro.
  const client = clientNameFromSlug(all, cliente, registered.map((c) => c.name));

  if (!client) {
    /*
     * Até o fluxo por cliente existir, o lote morava em `/social/<id>` — e é
     * esse endereço que está nos links já copiados por aí. Quando o pedaço da
     * URL é um lote, e não um cliente, ele vai para o endereço novo em vez de
     * dar 404.
     */
    const batch = all.find((b) => b.id === cliente);
    if (batch) redirect(`/social/${slugify(batch.client)}/${batch.id}`);
    // Cliente de outra agência cai no mesmo 404 de um cliente que não existe.
    notFound();
  }

  return (
    <BatchesView
      client={client}
      slug={cliente}
      initialBatches={batchesOfClient(all, cliente)}
    />
  );
}

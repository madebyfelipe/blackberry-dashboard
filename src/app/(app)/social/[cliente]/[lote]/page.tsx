import { notFound, redirect } from "next/navigation";
import { currentAgencyScope, redirectWithoutScope } from "@/lib/auth/session";
import { getBatch } from "@/lib/approval/repository";
import { slugify } from "@/lib/approval/clients";
import { LoteView } from "@/components/approval/LoteView";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lote" };

export default async function LotePage({
  params,
}: {
  params: Promise<{ cliente: string; lote: string }>;
}) {
  const { cliente, lote } = await params;
  const scope = await currentAgencyScope();
  if (!scope) return redirectWithoutScope();
  // Lote de outra agência cai no mesmo 404 de um lote que não existe.
  const batch = await getBatch(scope, lote);
  if (!batch) {
    /*
     * `/social/<id-do-lote>/editor` era o endereço antigo do editor, e agora
     * casa com esta rota lendo "editor" como se fosse o lote. Mandar para o
     * endereço novo é o mesmo cuidado que a rota do cliente tem com
     * `/social/<id-do-lote>`.
     */
    if (lote === "editor") {
      const antigo = await getBatch(scope, cliente);
      if (antigo) {
        redirect(`/social/${slugify(antigo.client)}/${antigo.id}/editor`);
      }
    }
    notFound();
  }
  /*
   * A URL carrega o cliente e o lote; o lote é quem manda. Endereço com o
   * cliente errado (ou antigo, se o nome mudou) vai para o canônico em vez de
   * mostrar uma trilha que mente.
   */
  const slug = slugify(batch.client);
  if (slug !== cliente) redirect(`/social/${slug}/${batch.id}`);
  return <LoteView initialBatch={batch} clientSlug={slug} />;
}

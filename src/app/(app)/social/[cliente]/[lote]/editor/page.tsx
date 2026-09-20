import { notFound, redirect } from "next/navigation";
import { getBatch } from "@/lib/approval/repository";
import { slugify } from "@/lib/approval/clients";
import { currentAgencyScope } from "@/lib/auth/session";
import { BatchEditor } from "@/components/approval/BatchEditor";

export const dynamic = "force-dynamic";

export default async function BatchEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ cliente: string; lote: string }>;
  searchParams: Promise<{ peca?: string }>;
}) {
  const { cliente, lote } = await params;
  const { peca } = await searchParams;
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");
  const batch = await getBatch(scope, lote);
  if (!batch) notFound();
  const slug = slugify(batch.client);
  if (slug !== cliente) {
    redirect(`/social/${slug}/${batch.id}/editor${peca ? `?peca=${peca}` : ""}`);
  }
  return <BatchEditor batch={batch} clientSlug={slug} initialPieceId={peca} />;
}

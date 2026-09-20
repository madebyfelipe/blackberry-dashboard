import { notFound, redirect } from "next/navigation";
import { getBatch } from "@/lib/approval/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { BatchEditor } from "@/components/approval/BatchEditor";

export const dynamic = "force-dynamic";

export default async function BatchEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ peca?: string }>;
}) {
  const { id } = await params;
  const { peca } = await searchParams;
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");
  const batch = await getBatch(scope, id);
  if (!batch) notFound();
  return <BatchEditor batch={batch} initialPieceId={peca} />;
}

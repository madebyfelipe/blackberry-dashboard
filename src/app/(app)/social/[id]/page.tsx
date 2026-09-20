import { notFound, redirect } from "next/navigation";
import { getBatch } from "@/lib/approval/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { LoteView } from "@/components/approval/LoteView";

export const dynamic = "force-dynamic";

export default async function LotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");
  // Lote de outra agência cai no mesmo 404 de um lote que não existe.
  const batch = await getBatch(scope, id);
  if (!batch) notFound();
  return <LoteView initialBatch={batch} />;
}

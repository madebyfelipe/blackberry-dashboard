import { notFound } from "next/navigation";
import { getBatch } from "@/lib/approval/repository";
import { LoteView } from "@/components/approval/LoteView";

export const dynamic = "force-dynamic";

export default async function LotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) notFound();
  return <LoteView initialBatch={batch} />;
}

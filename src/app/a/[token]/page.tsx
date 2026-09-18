import { notFound } from "next/navigation";
import { getBatchByToken } from "@/lib/approval/repository";
import { isBatchLinkActive } from "@/lib/approval/constants";
import { SwipeApproval } from "@/components/approval/SwipeApproval";

export const dynamic = "force-dynamic";

export default async function ApprovalLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const batch = await getBatchByToken(token);
  if (!batch) notFound();
  if (!isBatchLinkActive(batch)) return <ExpiredLink client={batch.client} />;
  return <SwipeApproval batch={batch} />;
}

function ExpiredLink({ client }: { client: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <h1 className="text-[18px] font-semibold text-fg">Este link não está mais ativo</h1>
      <p className="max-w-xs text-[14px] text-muted">
        Peça à sua agência um novo link de aprovação para o lote de {client}.
      </p>
    </main>
  );
}

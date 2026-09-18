import { notFound } from "next/navigation";
import { getBatchByToken } from "@/lib/approval/repository";
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
  return <SwipeApproval batch={batch} />;
}

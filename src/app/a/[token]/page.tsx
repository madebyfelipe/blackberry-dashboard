import { notFound } from "next/navigation";
import { getBatchByToken } from "@/lib/approval/repository";
import { isBatchLinkActive } from "@/lib/approval/constants";
import { ApprovalFlow } from "@/components/approval/ApprovalFlow";
import { getAgencySettings } from "@/lib/agency/repository";

export const dynamic = "force-dynamic";

/*
 * A tela do cliente roda sem sessão — e portanto sem agência. Quem autoriza é
 * o token, e ele alcança um lote só (ver `getBatchByToken`): o multi-tenant
 * não passa por aqui de propósito, e não pode passar, porque não há de onde
 * tirar uma agência confiável numa requisição sem login.
 */
export default async function ApprovalLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const batch = await getBatchByToken(token);
  if (!batch) notFound();
  if (!isBatchLinkActive(batch)) return <ExpiredLink client={batch.client} />;
  /*
   * O briefing do designer é da agência: sai daqui antes de a peça virar
   * props de um componente de cliente (e, portanto, HTML na tela dele).
   */
  const publicBatch = {
    ...batch,
    pieces: batch.pieces.map(({ briefing: _briefing, ...piece }) => piece),
  };
  // O logo da agência dona do lote — o lote diz de quem é, o token autoriza.
  const { logoUrl } = await getAgencySettings({ agencyId: batch.agencyId, agencyName: "" });
  return <ApprovalFlow batch={publicBatch} agencyLogoUrl={logoUrl} />;
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

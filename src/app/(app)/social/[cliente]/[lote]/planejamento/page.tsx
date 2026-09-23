import { notFound, redirect } from "next/navigation";
import { currentAgencyScope, redirectWithoutScope } from "@/lib/auth/session";
import { getBatch } from "@/lib/approval/repository";
import { slugify } from "@/lib/approval/clients";
import { PlanningCalendar } from "@/components/approval/PlanningCalendar";

export const dynamic = "force-dynamic";

export const metadata = { title: "Planejamento" };

/** Planejamento do lote — o calendário, a primeira tela depois de criar o lote. */
export default async function PlanejamentoPage({
  params,
}: {
  params: Promise<{ cliente: string; lote: string }>;
}) {
  const { cliente, lote } = await params;
  const scope = await currentAgencyScope();
  if (!scope) return redirectWithoutScope();
  const batch = await getBatch(scope, lote);
  if (!batch) notFound();
  const slug = slugify(batch.client);
  if (slug !== cliente) redirect(`/social/${slug}/${batch.id}/planejamento`);
  return <PlanningCalendar batch={batch} clientSlug={slug} />;
}

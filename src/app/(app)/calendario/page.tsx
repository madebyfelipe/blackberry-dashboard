import { redirect } from "next/navigation";
import { listBatches } from "@/lib/approval/repository";
import { currentAgencyScope } from "@/lib/auth/session";
import { CreativeComposer } from "@/components/approval/CreativeComposer";
import { Placeholder } from "@/components/Placeholder";

export const dynamic = "force-dynamic";

/*
 * Calendário editorial (issue #2, export "Clínica Aurora - Montagem de lote
 * Criativos"). O desenho é um composer de um criativo por vez — sem seletor
 * de cliente/lote na tela — então o lote é escolhido aqui: o que está em
 * rascunho (é para isso que a tela serve, montar o próximo lote), ou o
 * primeiro da agência se nenhum estiver. Sem lote nenhum, cai no placeholder
 * — não há o que montar antes de existir um lote (criado em Social media).
 */
export default async function CalendarioPage() {
  const scope = await currentAgencyScope();
  if (!scope) redirect("/login?sessao=encerrada");

  const batches = await listBatches(scope);
  const batch =
    batches.find((b) => (b.stage ?? "em-aprovacao") === "rascunho") ?? batches[0];

  if (!batch) {
    return (
      <Placeholder
        title="Calendário editorial"
        note="Ainda não existe nenhum lote. Crie um lote em Social media para começar a montar os criativos."
      />
    );
  }

  return <CreativeComposer batch={batch} />;
}

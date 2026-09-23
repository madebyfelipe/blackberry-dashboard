"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch } from "@/lib/approval/types";
import { batchProgress, progressCaption } from "@/lib/approval/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenAction, ScreenHeader } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { Toolbar, ToolbarSearch } from "@/components/ui/Toolbar";
import { CardRow, EntityCard } from "@/components/ui/EntityCard";
import { Badge } from "@/components/ui/Badge";
import { NewBatchModal, type NewBatchValues } from "./NewBatchModal";
import { useToast } from "@/components/ui/Toast";
import { ChevronRightIcon } from "@/components/icons";

/**
 * Lotes de um cliente — segundo passo do Social media, export "Lotes de
 * Aprovação" (e "ADD7", com o modal de criar aberto).
 *
 * É aqui que um lote nasce: até existir esta tela, uma agência recém-cadastrada
 * abria o Social media vazio e não tinha como sair de lá.
 */
export function BatchesView({
  client,
  slug,
  initialBatches,
}: {
  client: string;
  slug: string;
  initialBatches: Batch[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "rascunho" | "em-aprovacao">("todos");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((b) => b.label.toLowerCase().includes(q));
  }, [batches, search]);

  async function create(values: NewBatchValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, ...values }),
      });
      if (!res.ok) throw new Error();
      const { batch } = (await res.json()) as { batch: Batch };
      setBatches((list) => [...list, batch]);
      setCreating(false);
      toast("Lote criado. Agora é subir as artes.");
      /*
       * Um lote nasce vazio, e a única coisa a fazer com ele é colocar as
       * peças — o editor é o passo seguinte, não a grade vazia.
       */
      router.push(`/social/${slug}/${batch.id}/planejamento`);
    } catch {
      toast("Não foi possível criar o lote.", "error");
    } finally {
      setSaving(false);
    }
  }

  const stageOf = (b: Batch) => b.stage ?? "em-aprovacao";
  const byTab = filtered.filter((b) => tab === "todos" || stageOf(b) === tab);

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media", href: "/social" },
          { label: client },
        ]}
      />

      <ScreenHeader actions={<ScreenAction onClick={() => setCreating(true)}>Novo lote</ScreenAction>}>
        <TabStrip
          tabs={[
            { id: "todos", label: "Todos", count: batches.length },
            { id: "rascunho", label: "Rascunho", count: batches.filter((b) => stageOf(b) === "rascunho").length },
            { id: "em-aprovacao", label: "Em aprovação", count: batches.filter((b) => stageOf(b) === "em-aprovacao").length },
          ]}
          active={tab}
          onSelect={(id) => setTab(id as typeof tab)}
        />
      </ScreenHeader>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
        <Toolbar>
          <ToolbarSearch value={search} onChange={setSearch} placeholder="Buscar lote" />
        </Toolbar>

        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          {byTab.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
              <p className="text-[13px] text-muted">
                {batches.length === 0
                  ? `Nenhum lote de ${client} ainda.`
                  : search
                    ? "Nenhum lote com esse nome."
                    : "Nenhum lote aqui."}
              </p>
              {batches.length === 0 && (
                <ScreenAction onClick={() => setCreating(true)}>Criar o primeiro lote</ScreenAction>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {byTab.map((batch, i) => (
                <BatchCard key={batch.id} batch={batch} slug={slug} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      <NewBatchModal
        client={client}
        open={creating}
        saving={saving}
        onClose={() => !saving && setCreating(false)}
        onSubmit={create}
      />
    </Screen>
  );
}

function BatchCard({
  batch,
  slug,
  index,
}: {
  batch: Batch;
  slug: string;
  index: number;
}) {
  const router = useRouter();
  const p = batchProgress(batch);
  const draft = (batch.stage ?? "em-aprovacao") === "rascunho";
  return (
    <EntityCard
      index={index}
      name={batch.label}
      sub={`${p.total} ${p.total === 1 ? "peça" : "peças"}`}
      onClick={() => router.push(`/social/${slug}/${batch.id}`)}
      badge={<Badge label={draft ? "Rascunho" : "Em aprovação"} size="sm" />}
      footer={
        <>
          <span className="truncate text-[12px] text-muted">{progressCaption(batch)}</span>
          <ChevronRightIcon
            size={15}
            className="shrink-0 text-fg-3 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </>
      }
    >
      <div className="flex w-full flex-col gap-2">
        <CardRow label="Progresso">
          {p.decided} / {p.total}
        </CardRow>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-border">
          {/* Cresce da esquerda ao abrir a tela — `scaleX`, no compositor. */}
          <div
            className="h-1.5 origin-left rounded-pill bg-primary"
            style={{
              width: `${p.pct}%`,
              animation: "grow-x 0.6s var(--ease-out-soft) both",
              animationDelay: `${Math.min(index, 8) * 60 + 120}ms`,
            }}
          />
        </div>
      </div>
    </EntityCard>
  );
}

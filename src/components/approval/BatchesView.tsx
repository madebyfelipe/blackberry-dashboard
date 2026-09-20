"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Batch } from "@/lib/approval/types";
import { batchProgress, progressCaption } from "@/lib/approval/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { RoundIconButton } from "./RoundIconButton";
import { NewBatchModal, type NewBatchValues } from "./NewBatchModal";
import { useToast } from "@/components/ui/Toast";
import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SlidersIcon,
} from "@/components/icons";

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
  const [showSearch, setShowSearch] = useState(false);
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
      router.push(`/social/${slug}/${batch.id}/editor`);
    } catch {
      toast("Não foi possível criar o lote.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "black berry", href: "/tarefas" },
            { label: "Social media", href: "/social" },
            { label: client },
          ]}
        />

        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {showSearch && (
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setShowSearch(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    setShowSearch(false);
                  }
                }}
                placeholder="Buscar lote…"
                className="absolute left-0 top-1/2 h-10 w-[240px] max-w-[calc(100vw-32px)] -translate-y-1/2 animate-fade-in rounded-pill border border-border bg-surface pl-4 pr-12 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none md:left-auto md:right-0"
              />
            )}
            <RoundIconButton
              label="Buscar lote"
              onClick={() => setShowSearch((v) => !v)}
              active={showSearch || !!search}
            >
              <SearchIcon size={18} />
            </RoundIconButton>
          </div>

          <RoundIconButton
            label="Filtrar lotes"
            onClick={() => toast("Os filtros de lote ainda não têm desenho.", "info")}
          >
            <SlidersIcon size={18} />
          </RoundIconButton>
          <RoundIconButton
            label="Organizar lotes"
            onClick={() => toast("Organizar lotes ainda não tem desenho.", "info")}
          >
            <Settings2Icon size={18} />
          </RoundIconButton>

          <RoundIconButton
            tone="primary"
            label="Novo lote"
            onClick={() => setCreating(true)}
          >
            <PlusIcon size={18} />
          </RoundIconButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border px-5 py-10 text-center">
          <p className="text-[13px] text-muted">
            {batches.length === 0
              ? `Nenhum lote de ${client} ainda.`
              : "Nenhum lote com esse nome."}
          </p>
          {batches.length === 0 && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="tap flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-semibold text-on-primary transition-colors hover:bg-white"
            >
              <PlusIcon size={16} /> Criar o primeiro lote
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((batch, i) => (
            <BatchCard key={batch.id} batch={batch} slug={slug} index={i} />
          ))}
        </div>
      )}

      <NewBatchModal
        client={client}
        open={creating}
        saving={saving}
        onClose={() => !saving && setCreating(false)}
        onSubmit={create}
      />
    </div>
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
  const p = batchProgress(batch);
  return (
    <Link
      href={`/social/${slug}/${batch.id}`}
      style={{ ["--d" as string]: index }}
      className="stagger-item group flex flex-col gap-4 rounded-panel border border-border p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
    >
      {/* Card Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-thumb bg-border text-[14px] font-semibold text-fg-soft transition-transform duration-200 group-hover:scale-105">
          {batch.client.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg-soft">
          {batch.label}
        </span>
        <ChevronRightIcon
          size={18}
          className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1"
        />
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.5px] text-muted">
            PROGRESSO DO LOTE
          </span>
          <span className="text-[13px] font-semibold text-fg-soft">
            {p.decided} / {p.total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-border">
          {/*
           * A barra cresce da esquerda ao abrir a tela: `scaleX` em vez de
           * `width` para a animação ficar no compositor.
           */}
          <div
            className="h-1.5 origin-left rounded-pill bg-primary"
            style={{
              width: `${p.pct}%`,
              animation: "grow-x 0.6s var(--ease-out-soft) both",
              animationDelay: `${Math.min(index, 8) * 60 + 120}ms`,
            }}
          />
        </div>
        <span className="text-[12px] text-muted">{progressCaption(batch)}</span>
      </div>
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { Batch, Piece, PieceStatus } from "@/lib/approval/types";
import { batchLinkStatus, batchProgress, progressCaption } from "@/lib/approval/constants";
import { formatPieceDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { PieceThumb } from "./PieceThumb";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/tasks/ActionMenu";
import { CopyIcon, RotateIcon, ExternalLinkIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Filter = "todas" | PieceStatus;

export function LoteView({ initialBatch }: { initialBatch: Batch }) {
  const { toast } = useToast();
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const [filter, setFilter] = useState<Filter>("todas");
  const [selectedId, setSelectedId] = useState<string>(
    initialBatch.pieces.find((p) => p.status === "ajuste")?.id ??
      initialBatch.pieces[0]?.id ??
      "",
  );

  const progress = batchProgress(batch);
  const publicUrl = `https://app.blackberry.com.br/a/${batch.token}`;
  const linkStatus = batchLinkStatus(batch);

  const filtered = useMemo(() => {
    if (filter === "todas") return batch.pieces;
    return batch.pieces.filter((p) => p.status === filter);
  }, [batch, filter]);

  const selected = batch.pieces.find((p) => p.id === selectedId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("Link copiado.");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  async function manageLink(action: "regenerate" | "revoke" | "reactivate") {
    try {
      const res = await fetch(`/api/batches/${batch.id}/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      const { batch: updated } = await res.json();
      setBatch((b) => ({ ...b, ...updated }));
      toast(
        action === "regenerate"
          ? "Novo link gerado."
          : action === "revoke"
            ? "Link desativado."
            : "Link reativado.",
      );
    } catch {
      toast("Não foi possível atualizar o link.", "error");
    }
  }

  async function markRedone(piece: Piece) {
    const prev = batch;
    setBatch((b) => ({
      ...b,
      pieces: b.pieces.map((p) =>
        p.id === piece.id ? { ...p, status: "pendente", reason: undefined } : p,
      ),
    }));
    try {
      const res = await fetch(
        `/api/batches/${batch.id}/pieces/${piece.id}/redo`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      const { piece: updated } = await res.json();
      setBatch((b) => ({
        ...b,
        pieces: b.pieces.map((p) => (p.id === updated.id ? updated : p)),
      }));
      toast("Peça marcada como refeita.");
    } catch {
      setBatch(prev);
      toast("Não foi possível atualizar.", "error");
    }
  }

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "todas", label: "Todas", count: progress.total },
    { id: "aprovado", label: "Aprovadas", count: progress.aprovadas },
    { id: "ajuste", label: "Ajuste", count: progress.ajuste },
    { id: "pendente", label: "Pendentes", count: progress.pendentes },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 py-6 pl-2 pr-6">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media", href: "/social" },
          { label: batch.client },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-mark bg-[#616161] text-[14px] font-bold text-fg">
              {batch.client.charAt(0)}
            </span>
            <div>
              <div className="text-[16px] font-semibold text-fg-soft">
                {batch.client}
              </div>
              <div className="text-[12px] text-muted">{batch.label}</div>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-border sm:block" />

          <div className="flex w-[220px] flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-[0.3px] text-muted">
                PROGRESSO DO LOTE
              </span>
              <span className="text-[13px] font-semibold text-fg-soft">
                {progress.decided} / {progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-pill bg-border">
              <div
                className="h-2 rounded-pill bg-primary transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="text-[12px] text-muted">{progressCaption(batch)}</span>
          </div>
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2">
          <LinkStatusPill status={linkStatus} />
          <div className="max-w-[280px] truncate rounded-field border border-border bg-surface px-4 py-2.5 text-[13px] text-fg-2">
            {publicUrl}
          </div>
          <Button className="w-fit" onClick={copyLink} disabled={linkStatus !== "ativo"}>
            <span className="flex items-center gap-2">
              <CopyIcon size={16} /> Copiar link
            </span>
          </Button>
          <a
            href={`/a/${batch.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-field border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-fg-soft transition-colors hover:bg-surface-2"
          >
            <ExternalLinkIcon size={16} /> Abrir
          </a>
          <ActionMenu
            items={[
              {
                label: "Gerar novo link",
                icon: <RotateIcon size={15} />,
                onSelect: () => manageLink("regenerate"),
              },
              linkStatus === "revogado"
                ? {
                    label: "Reativar link",
                    icon: <ExternalLinkIcon size={15} />,
                    onSelect: () => manageLink("reactivate"),
                  }
                : {
                    label: "Desativar link",
                    icon: <XIcon size={15} />,
                    danger: true,
                    onSelect: () => manageLink("revoke"),
                  },
            ]}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Pieces panel */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
              /PEÇAS DO LOTE
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={cn(
                    "rounded-pill px-4 py-2 text-[13px] transition-colors",
                    filter === c.id
                      ? "bg-primary text-on-primary"
                      : "text-fg-soft outline outline-1 -outline-offset-[0.5px] outline-border hover:bg-border",
                  )}
                >
                  {c.label} {c.count}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 overflow-y-auto p-5 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="group flex flex-col gap-2 text-left"
              >
                <PieceThumb
                  size={p.size}
                  status={p.status}
                  className={cn(
                    "h-[130px] w-full transition-all",
                    selectedId === p.id
                      ? "outline outline-2 outline-border-strong"
                      : "group-hover:border-border-strong",
                  )}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-fg-soft">
                    {p.name}
                  </span>
                  <span className="text-[12px] text-muted">
                    {formatPieceDate(p.date)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Detail panel */}
        <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          {selected ? (
            <DetailPanel
              piece={selected}
              onRedo={() => markRedone(selected)}
              onEditor={() => toast("Editor abrirá aqui em breve.", "info")}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-[13px] text-muted">
              Selecione uma peça para ver os detalhes.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LinkStatusPill({ status }: { status: ReturnType<typeof batchLinkStatus> }) {
  if (status === "ativo") return null;
  return (
    <span className="rounded-pill bg-border-strong px-3 py-1.5 text-[12px] font-medium text-fg-soft">
      Link {status}
    </span>
  );
}

function DetailPanel({
  piece,
  onRedo,
  onEditor,
}: {
  piece: Piece;
  onRedo: () => void;
  onEditor: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
          /{piece.name.toUpperCase()}
        </h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <PieceThumb size={piece.size} status={piece.status} className="h-[200px] w-full" />

        <div className="flex flex-col gap-1">
          <div className="text-[15px] font-semibold text-fg">{piece.name}</div>
          <div className="text-[13px] text-muted">{piece.kind}</div>
          <div className="text-[13px] text-muted">
            Prevista para {formatPieceDate(piece.date)}
          </div>
        </div>

        {piece.reason && (
          <div className="rounded-[16px] border border-border bg-surface p-3 text-[13px] text-fg-2">
            <span className="text-muted">Motivo do ajuste: </span>
            {piece.reason}
          </div>
        )}

        <div className="h-px bg-border" />

        <div>
          <h3 className="mb-3 text-[12px] font-semibold tracking-[0.3px] text-muted">
            HISTÓRICO DE DECISÃO
          </h3>
          <div className="flex flex-col gap-3">
            {piece.history.map((h) => (
              <div key={h.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border-strong" />
                <div className="flex flex-col">
                  <span className="text-[13px] text-fg-soft">{h.title}</span>
                  <span className="text-[12px] text-muted">
                    {h.who}
                    {h.ip ? ` · IP ${h.ip}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        {piece.status === "ajuste" && (
          <Button onClick={onRedo}>
            <span className="flex items-center gap-2">
              <RotateIcon size={15} /> Marcar como refeita
            </span>
          </Button>
        )}
        <Button variant="secondary" onClick={onEditor}>
          <span className="flex items-center gap-2">
            <ExternalLinkIcon size={15} /> Abrir no editor
          </span>
        </Button>
      </div>
    </div>
  );
}

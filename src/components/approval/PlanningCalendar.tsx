"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Batch, Piece, PieceFormat } from "@/lib/approval/types";
import { CAPTION_LIMIT, pieceFormat } from "@/lib/approval/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen } from "@/components/ui/Screen";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CirclePlayIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayoutGridIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
} from "@/components/icons";
import { BatchViewToggle } from "./BatchViewToggle";
import { RoundIconButton } from "./RoundIconButton";
import { ShareBatchModal } from "./ShareBatchModal";

/*
 * Planejamento — o lote como calendário.
 *
 * TELA PROVISÓRIA: ainda não há desenho. É a primeira tela depois de criar o
 * lote (pedido do Felipe) e alterna com o editor de criativos pela mesma
 * pílula. Cada dia mostra os criativos marcados para ele; o "+" que aparece
 * no hover cria um criativo naquele dia com o essencial — formato, legenda e
 * o briefing do designer. Arquivos continuam no editor ("Abrir no editor").
 *
 * Um criativo daqui é uma peça como outra qualquer, pelas mesmas rotas do
 * editor — e, como toda peça nova, vira tarefa no fluxo do cliente.
 */

const FORMATS: { id: PieceFormat; label: string; Icon: typeof ImageIcon }[] = [
  { id: "feed", label: "Post", Icon: ImageIcon },
  { id: "carrossel", label: "Carrossel", Icon: LayoutGridIcon },
  { id: "stories", label: "Stories", Icon: CirclePlayIcon },
  { id: "reels", label: "Reels", Icon: ClapperboardIcon },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "2026-09-24" no fuso de quem está olhando — a chave do dia no calendário. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Meio-dia do dia escolhido: longe da meia-noite, o fuso não empurra a data. */
function noonOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

function monthLabel(y: number, m: number): string {
  const s = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Draft = {
  pieceId: string | null;
  day: string;
  name: string;
  format: PieceFormat;
  caption: string;
  briefing: string;
};

export function PlanningCalendar({ batch: initialBatch, clientSlug }: { batch: Batch; clientSlug: string }) {
  const { toast } = useToast();
  const [batch, setBatch] = useState(initialBatch);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Abre no mês do primeiro criativo; lote vazio abre no mês de hoje.
  const [cursor, setCursor] = useState(() => {
    const first = [...initialBatch.pieces].sort((a, b) => a.date.localeCompare(b.date))[0];
    const d = first ? new Date(first.date) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Piece[]>();
    for (const p of batch.pieces) {
      const d = new Date(p.date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
  }, [batch.pieces]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    // Só as semanas que o mês ocupa (5 ou 6) — sem uma linha inteira do mês seguinte.
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + days) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, key: dayKey(d), inMonth: d.getMonth() === cursor.m };
    });
  }, [cursor]);

  const today = dayKey(new Date());

  function shift(delta: number) {
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function openNew(day: string) {
    setDraft({ pieceId: null, day, name: "", format: "feed", caption: "", briefing: "" });
  }

  function openPiece(p: Piece) {
    setDraft({
      pieceId: p.id,
      day: dayKey(new Date(p.date)),
      name: p.name,
      format: pieceFormat(p),
      caption: p.caption ?? "",
      briefing: p.briefing ?? "",
    });
  }

  function upsert(piece: Piece) {
    setBatch((b) => ({
      ...b,
      stage: "rascunho",
      pieces: b.pieces.some((p) => p.id === piece.id)
        ? b.pieces.map((p) => (p.id === piece.id ? piece : p))
        : [...b.pieces, piece],
    }));
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      let id = draft.pieceId;
      if (!id) {
        const res = await fetch(`/api/batches/${batch.id}/pieces`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Falha ao criar o criativo.");
        id = (data.piece as Piece).id;
      }
      const n = batch.pieces.length + (draft.pieceId ? 0 : 1);
      const res = await fetch(`/api/batches/${batch.id}/pieces/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim() || `Criativo ${String(n).padStart(2, "0")}`,
          format: draft.format,
          caption: draft.caption,
          briefing: draft.briefing,
          date: noonOf(draft.day),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao salvar o criativo.");
      upsert(data.piece as Piece);
      toast(draft.pieceId ? "Criativo atualizado." : "Criativo planejado — a tarefa já foi para o time.");
      setDraft(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  /** O salvar do topo: fecha o rascunho e abre o QR code com o link. */
  async function saveBatch() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/batches/${batch.id}/send`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao salvar o lote.");
      setBatch((b) => ({ ...b, stage: data.batch.stage }));
      setSharing(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar o lote.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen gap="md">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "black berry", href: "/tarefas" },
            { label: "Social media", href: "/social" },
            { label: batch.client, href: `/social/${clientSlug}` },
            { label: batch.label, href: `/social/${clientSlug}/${batch.id}` },
            { label: "Planejamento" },
          ]}
        />
        <div className="flex items-center gap-2.5">
          <BatchViewToggle clientSlug={clientSlug} batchId={batch.id} active="planejamento" />
          <RoundIconButton
            label="Salvar lote e gerar link"
            tone="primary"
            disabled={saving}
            onClick={() => void saveBatch()}
          >
            {saving && !draft ? <Spinner size={16} /> : <SaveIcon size={18} />}
          </RoundIconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RoundIconButton label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeftIcon size={18} />
          </RoundIconButton>
          <h1 className="min-w-[170px] text-center text-[17px] font-semibold text-fg">
            {monthLabel(cursor.y, cursor.m)}
          </h1>
          <RoundIconButton label="Próximo mês" onClick={() => shift(1)}>
            <ChevronRightIcon size={18} />
          </RoundIconButton>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              setCursor({ y: d.getFullYear(), m: d.getMonth() });
            }}
            className="tap ml-1 rounded-pill border border-border px-3 py-1.5 text-[12px] font-medium text-fg-3 hover:text-fg-soft"
          >
            Hoje
          </button>
        </div>
        <p className="text-[12px] text-muted">
          {batch.pieces.length} {batch.pieces.length === 1 ? "criativo" : "criativos"} no lote · passe o mouse num
          dia e clique em + para planejar
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 overflow-hidden rounded-panel border border-border">
          {WEEKDAYS.map((w) => (
            <div key={w} className="border-b border-border bg-surface px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.6px] text-label">
              {w}
            </div>
          ))}
          {cells.map((c, i) => {
            const pieces = byDay.get(c.key) ?? [];
            return (
              <div
                key={c.key}
                className={cn(
                  "group relative flex min-h-[112px] flex-col gap-1 border-border p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < cells.length - 7 && "border-b",
                  c.inMonth ? "bg-bg" : "bg-surface/40",
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-pill px-1 text-[12px] font-medium tabular-nums",
                      c.key === today ? "bg-primary text-on-primary" : c.inMonth ? "text-fg-3" : "text-faint",
                    )}
                  >
                    {c.date.getDate()}
                  </span>
                  <button
                    type="button"
                    aria-label={`Planejar criativo em ${c.date.toLocaleDateString("pt-BR")}`}
                    onClick={() => openNew(c.key)}
                    className="flex h-6 w-6 items-center justify-center rounded-pill bg-primary text-on-primary opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <PlusIcon size={14} strokeWidth={2.5} />
                  </button>
                </div>
                {pieces.map((p) => {
                  const f = FORMATS.find((x) => x.id === pieceFormat(p)) ?? FORMATS[0];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openPiece(p)}
                      title={p.name}
                      className="tap flex w-full items-center gap-1.5 rounded-mark bg-surface-2 px-2 py-1 text-left text-[11px] text-fg-soft transition-colors hover:bg-border"
                    >
                      <f.Icon size={12} className="shrink-0 text-fg-3" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {draft && (
        <PlanDialog
          draft={draft}
          saving={saving}
          editorHref={draft.pieceId ? `/social/${clientSlug}/${batch.id}/editor?peca=${draft.pieceId}` : null}
          onChange={setDraft}
          onSave={() => void save()}
          onClose={() => setDraft(null)}
        />
      )}

      {sharing && <ShareBatchModal batch={batch} clientSlug={clientSlug} onClose={() => setSharing(false)} />}
      </div>
    </Screen>
  );
}

function PlanDialog({
  draft,
  saving,
  editorHref,
  onChange,
  onSave,
  onClose,
}: {
  draft: Draft;
  saving: boolean;
  editorHref: string | null;
  onChange: React.Dispatch<React.SetStateAction<Draft | null>>;
  onSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [y, m, d] = draft.day.split("-").map(Number);
  const dayLabel = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  // Sempre a partir do estado mais novo: duas mudanças no mesmo instante
  // (autocompletar, digitação rápida) não podem apagar uma à outra.
  const set = (patch: Partial<Draft>) => onChange((d) => (d ? { ...d, ...patch } : d));

  return (
    <div role="dialog" aria-modal="true" aria-label="Criativo do dia" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-[460px] animate-scale-in flex-col gap-4 overflow-y-auto rounded-card border border-border bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold text-fg">{draft.pieceId ? "Editar criativo" : "Novo criativo"}</h2>
            <p className="text-[12px] capitalize text-muted">{dayLabel}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted hover:text-fg-soft">
            <XIcon size={16} />
          </button>
        </header>

        <div className="flex gap-1 rounded-panel border border-border bg-bg p-1" role="radiogroup" aria-label="Formato">
          {FORMATS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={draft.format === id}
              onClick={() => set({ format: id })}
              className={cn(
                "tap flex flex-1 flex-col items-center gap-1.5 rounded-mark py-2.5 text-[11px] font-semibold transition-colors",
                draft.format === id ? "bg-primary text-on-primary" : "text-muted hover:text-fg-soft",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted">Nome (opcional)</span>
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ex.: Promo dia dos pais"
            className="rounded-panel border border-border bg-bg px-3.5 py-2.5 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-[12px] font-semibold text-muted">
            Legenda
            <span className="font-normal">
              {draft.caption.length.toLocaleString("pt-BR")} / {CAPTION_LIMIT.toLocaleString("pt-BR")}
            </span>
          </span>
          <textarea
            value={draft.caption}
            maxLength={CAPTION_LIMIT}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="A legenda que o cliente vai aprovar…"
            className="min-h-[96px] resize-y rounded-panel border border-border bg-bg px-3.5 py-2.5 text-[13px]/[19px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-muted">Briefing para o designer</span>
          <textarea
            value={draft.briefing}
            maxLength={4000}
            onChange={(e) => set({ briefing: e.target.value })}
            placeholder="Referências, texto da arte, o que não pode faltar… (só a agência vê)"
            className="min-h-[96px] resize-y rounded-panel border border-border bg-bg px-3.5 py-2.5 text-[13px]/[19px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {editorHref ? (
            <Link href={editorHref} className="flex items-center gap-1.5 text-[12px] font-medium text-fg-3 hover:text-fg-soft">
              <ExternalLinkIcon size={13} /> Abrir no editor (arquivos)
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="tap rounded-panel px-4 py-2.5 text-[13px] font-medium text-fg-3 hover:text-fg-soft">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="tap flex items-center gap-2 rounded-panel bg-primary px-4 py-2.5 text-[13px] font-semibold text-on-primary hover:bg-white disabled:opacity-60"
            >
              {saving && <Spinner size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

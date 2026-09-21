"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, Piece, PieceFormat } from "@/lib/approval/types";
import { CAPTION_LIMIT, pieceFormat } from "@/lib/approval/constants";
import { formatPieceDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { ActionMenu } from "@/components/tasks/ActionMenu";
import { MediaDropzone } from "./MediaDropzone";
import { PieceThumb } from "./PieceThumb";
import { RoundIconButton } from "./RoundIconButton";
import { cn } from "@/lib/cn";
import {
  AtSignIcon,
  CircleDashedIcon,
  CirclePlayIcon,
  ClapperboardIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  HashIcon,
  ImageIcon,
  LayoutGridIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  Settings2Icon,
  SlidersIcon,
  SmileIcon,
  SparklesIcon,
  TrashIcon,
} from "@/components/icons";

/*
 * Editor de lote — export "Clínica Aurora - Montagem de lote Criativos"
 * (issue #2), substituindo o editor anterior (export "Clínica Aurora -
 * Editor de Lote").
 *
 * A jornada é: Social media > cliente > "+" (NewBatchModal, título/período/
 * descrição) > esta tela, onde entram os criativos do lote — nome, formato,
 * arquivos (carrossel) e legenda, um de cada vez, com a lista "Criativos do
 * lote" ao lado mostrando o que já foi montado.
 *
 * Um criativo daqui é uma peça do lote como outra qualquer — sem rota nova:
 * `addPiece`/`updatePieceDraft`/`addPieceMedia`/`removePieceMedia`, os
 * mesmos que o resto do fluxo de aprovação usa.
 */

const FORMAT_OPTIONS: {
  id: PieceFormat;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactNode;
}[] = [
  { id: "carrossel", label: "Carrossel", Icon: LayoutGridIcon },
  { id: "feed", label: "Post", Icon: ImageIcon },
  { id: "reels", label: "Reels", Icon: ClapperboardIcon },
  { id: "stories", label: "Stories", Icon: CirclePlayIcon },
];

function formatLabel(id: PieceFormat): string {
  return FORMAT_OPTIONS.find((f) => f.id === id)?.label ?? "Carrossel";
}

function pieceDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? "hoje" : formatPieceDate(iso);
}

export function CreativeComposer({
  batch: initialBatch,
  clientSlug,
  initialPieceId,
}: {
  batch: Batch;
  clientSlug: string;
  initialPieceId?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [batch, setBatch] = useState<Batch>(initialBatch);

  const initialPiece = initialPieceId
    ? initialBatch.pieces.find((p) => p.id === initialPieceId)
    : undefined;

  // O criativo aberto no composer — null enquanto nada foi salvo ainda.
  const [composerId, setComposerId] = useState<string | null>(initialPiece?.id ?? null);
  const [name, setName] = useState(initialPiece?.name ?? "");
  const [format, setFormat] = useState<PieceFormat>(
    initialPiece ? pieceFormat(initialPiece) : "carrossel",
  );
  const [caption, setCaption] = useState(initialPiece?.caption ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Uma criação de criativo por vez — sem isso, salvar e "Novo criativo" em
  // sequência rápida (antes do primeiro POST voltar) criam dois criativos em
  // vez de um só, os dois vazios.
  const creating = useRef<Promise<string> | null>(null);

  const composerPiece = batch.pieces.find((p) => p.id === composerId);

  const visiblePieces = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? batch.pieces.filter((p) => p.name.toLowerCase().includes(q)) : batch.pieces;
    // Mais recente primeiro — é o que se acabou de montar que importa ver.
    return [...list].reverse();
  }, [batch.pieces, query]);

  function reset() {
    setComposerId(null);
    setName("");
    setFormat("carrossel");
    setCaption("");
  }

  function applyResult(data: { batch: Batch; piece: Piece }) {
    setBatch((b) => ({
      ...b,
      draftSavedAt: data.batch.draftSavedAt,
      pieces: b.pieces.some((p) => p.id === data.piece.id)
        ? b.pieces.map((p) => (p.id === data.piece.id ? data.piece : p))
        : [...b.pieces, data.piece],
    }));
  }

  /** Garante que o criativo aberto já existe no lote — cria na primeira gravação. */
  async function ensurePieceId(): Promise<string> {
    if (composerId) return composerId;
    if (creating.current) return creating.current;
    const promise = (async () => {
      const res = await fetch(`/api/batches/${batch.id}/pieces`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao criar o criativo.");
      const { piece: created } = (await res.json()) as { piece: Piece };
      setBatch((b) => ({ ...b, pieces: [...b.pieces, created], stage: "rascunho" }));
      setComposerId(created.id);
      return created.id;
    })();
    creating.current = promise;
    try {
      return await promise;
    } finally {
      creating.current = null;
    }
  }

  async function saveDraft(): Promise<void> {
    if (!name.trim() && !caption.trim() && !composerId) return;
    setSaving(true);
    try {
      const defaultName = composerPiece
        ? composerPiece.name
        : `Criativo ${String(batch.pieces.length + 1).padStart(2, "0")}`;
      const id = await ensurePieceId();
      const res = await fetch(`/api/batches/${batch.id}/pieces/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || defaultName,
          format,
          caption,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao salvar.");
      applyResult((await res.json()) as { batch: Batch; piece: Piece });
      toast("Criativo salvo.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function startNew() {
    await saveDraft();
    reset();
  }

  async function openPiece(p: Piece) {
    if (p.id === composerId) return;
    await saveDraft();
    setComposerId(p.id);
    setName(p.name);
    setFormat(pieceFormat(p));
    setCaption(p.caption ?? "");
  }

  /** Sobe um arquivo e acrescenta ao carrossel do criativo aberto. */
  async function addSlide(pieceId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/batches/${batch.id}/pieces/${pieceId}/media`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Falha ao subir a arte.");
    applyResult(data as { batch: Batch; piece: Piece });
  }

  /**
   * Um ou vários arquivos de uma vez — cada um vira uma lâmina do carrossel,
   * em ordem. Resolve o id do criativo uma única vez antes do laço: chamar
   * `ensurePieceId` de novo a cada arquivo leria `composerId` do estado, que
   * só atualiza no próximo render — cada arquivo criaria o seu próprio
   * criativo em vez de entrar no mesmo.
   */
  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const id = await ensurePieceId();
      for (const file of files) {
        await addSlide(id, file);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao subir a arte.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function removeSlide(mediaId: string) {
    if (!composerId) return;
    try {
      const res = await fetch(
        `/api/batches/${batch.id}/pieces/${composerId}/media?mediaId=${mediaId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao remover a arte.");
      applyResult(data as { batch: Batch; piece: Piece });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao remover a arte.", "error");
    }
  }

  const captionLength = caption.length;
  const slides = composerPiece?.media ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-1 py-5 md:py-6 md:pl-2 md:pr-6">
      {/* Header Row — trilha à esquerda, ações à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "black berry", href: "/tarefas" },
            { label: "Social media", href: "/social" },
            { label: batch.client, href: `/social/${clientSlug}` },
            { label: batch.label, href: `/social/${clientSlug}/${batch.id}` },
            { label: "Editor" },
          ]}
        />

        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {showSearch && (
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onBlur={() => !query && setShowSearch(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setShowSearch(false);
                  }
                }}
                placeholder="Buscar criativo…"
                className="absolute left-0 top-1/2 h-10 w-[240px] max-w-[calc(100vw-32px)] -translate-y-1/2 animate-fade-in rounded-pill border border-border bg-surface pl-4 pr-12 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none md:left-auto md:right-0"
              />
            )}
            <RoundIconButton
              label="Buscar criativo"
              onClick={() => setShowSearch((v) => !v)}
              active={showSearch || !!query}
            >
              <SearchIcon size={18} />
            </RoundIconButton>
          </div>

          <RoundIconButton
            label="Filtrar criativos"
            onClick={() => toast("Os filtros de criativos ainda não têm desenho.", "info")}
          >
            <SlidersIcon size={18} />
          </RoundIconButton>
          <RoundIconButton
            label="Configurações da tela"
            onClick={() => toast("Configurações da tela ainda não têm desenho.", "info")}
          >
            <Settings2Icon size={18} />
          </RoundIconButton>
          <RoundIconButton
            label="Salvar alterações"
            tone="primary"
            disabled={saving}
            onClick={() => void saveDraft()}
          >
            {saving ? <Spinner size={16} /> : <SaveIcon size={18} />}
          </RoundIconButton>
        </div>
      </div>

      {/* Body — composer à esquerda, lista de criativos do lote à direita */}
      <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row">
        {/* Composer */}
        <section className="flex w-full shrink-0 flex-col gap-5 lg:w-[400px]">
          <div className="flex flex-col gap-2">
            <label htmlFor="creative-name" className="text-[12px] font-semibold text-muted">
              Nome do criativo
            </label>
            <input
              id="creative-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lançamento Skinbooster — Julho"
              className="w-full rounded-panel border border-border bg-surface px-3.5 py-3 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-muted">Formato do conteúdo</span>
            <div className="flex gap-1 rounded-panel border border-border bg-surface p-1">
              {FORMAT_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormat(id)}
                  aria-pressed={format === id}
                  className={cn(
                    "tap flex flex-1 flex-col items-center gap-1.5 rounded-mark py-2.5 text-[11px] font-semibold transition-colors",
                    format === id
                      ? "bg-primary text-on-primary"
                      : "text-muted hover:text-fg-soft",
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-muted">Arquivos do criativo</span>
              {slides.length > 1 && (
                <span className="text-[11px] text-muted">{slides.length} lâminas</span>
              )}
            </div>
            {slides.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slides.map((asset) => (
                  <div key={asset.id} className="group/thumb relative h-14 w-14 shrink-0">
                    <PieceThumb
                      size={composerPiece?.size ?? ""}
                      media={asset}
                      showBadge={false}
                      plain
                      className="h-14 w-14"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlide(asset.id)}
                      aria-label={`Remover ${asset.name}`}
                      className="tap absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-mark bg-black/70 text-fg-soft opacity-0 backdrop-blur-sm transition-opacity group-hover/thumb:opacity-100"
                    >
                      <TrashIcon size={11} />
                    </button>
                  </div>
                ))}
                <MediaDropzone
                  multiple
                  disabled={uploading}
                  onFiles={handleFiles}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-thumb border border-border-strong bg-surface hover:bg-surface-2"
                >
                  {uploading ? (
                    <Spinner size={16} className="text-fg-3" />
                  ) : (
                    <PlusIcon size={18} className="text-fg-3" />
                  )}
                </MediaDropzone>
              </div>
            ) : (
              <MediaDropzone
                multiple
                disabled={uploading}
                onFiles={handleFiles}
                className="flex flex-col items-center gap-1.5 rounded-panel border border-dashed border-border bg-bg px-5 py-6 text-center hover:border-border-strong"
              >
                {uploading ? (
                  <Spinner size={20} className="text-fg-3" />
                ) : (
                  <CloudUploadIcon size={18} className="text-fg-3" />
                )}
                <span className="text-[13px] font-medium text-fg-soft">
                  {uploading ? "Enviando…" : "Arraste os arquivos ou clique para enviar"}
                </span>
                <span className="text-[11px] text-muted">
                  PNG, JPG, WEBP, GIF ou MP4/MOV até 50 MB — mais de um vira carrossel
                </span>
              </MediaDropzone>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="creative-caption" className="text-[12px] font-semibold text-muted">
                Legenda
              </label>
              <span className="text-[11px] text-muted">
                {captionLength.toLocaleString("pt-BR")} / {CAPTION_LIMIT.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex min-h-[180px] flex-1 flex-col gap-2.5 rounded-panel border border-border bg-surface p-3.5">
              <textarea
                id="creative-caption"
                value={caption}
                maxLength={CAPTION_LIMIT}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escreva a legenda deste criativo…"
                className="min-h-0 flex-1 resize-none bg-transparent text-[13px]/[19px] text-fg-soft placeholder:text-muted focus:outline-none"
              />
              <div className="flex items-center gap-3.5 border-t border-border pt-2.5 text-muted">
                <SmileIcon size={16} className="cursor-not-allowed opacity-60" />
                <button
                  type="button"
                  onClick={() => setCaption((c) => c + (c.endsWith(" ") || !c ? "#" : " #"))}
                  aria-label="Inserir hashtag"
                  className="tap transition-colors hover:text-fg-soft"
                >
                  <HashIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCaption((c) => c + (c.endsWith(" ") || !c ? "@" : " @"))}
                  aria-label="Inserir menção"
                  className="tap transition-colors hover:text-fg-soft"
                >
                  <AtSignIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => toast("A legenda por IA ainda não tem desenho.", "info")}
                  aria-label="Gerar legenda com IA"
                  className="tap transition-colors hover:text-fg-soft"
                >
                  <SparklesIcon size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2.5">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
              className="tap flex h-11 flex-1 items-center justify-center gap-2 rounded-panel border border-border-strong text-[13px] font-semibold text-fg-soft transition-colors hover:bg-surface disabled:opacity-60"
            >
              {saving ? <Spinner size={15} /> : <SaveIcon size={16} />}
              Salvar criativo
            </button>
            <RoundIconButton
              tone="primary"
              label="Novo criativo"
              disabled={saving}
              onClick={() => void startNew()}
            >
              <PlusIcon size={18} />
            </RoundIconButton>
          </div>
        </section>

        {/* Criativos do lote */}
        <section className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          <span className="text-[12px] font-semibold text-muted">Criativos do lote</span>

          {visiblePieces.length === 0 ? (
            <p className="text-[13px] text-muted">
              {query ? "Nenhum criativo com esse nome." : "Nenhum criativo montado ainda."}
            </p>
          ) : (
            visiblePieces.map((p, i) => {
              const active = p.id === composerId;
              const FormatIcon = FORMAT_OPTIONS.find((f) => f.id === pieceFormat(p))?.Icon ?? CircleDashedIcon;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void openPiece(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void openPiece(p);
                    }
                  }}
                  style={{ ["--d" as string]: i }}
                  className={cn(
                    "stagger-item tap flex w-full cursor-pointer items-center gap-3 rounded-panel border p-2.5 text-left transition-colors",
                    active
                      ? "border-border-strong bg-surface-2"
                      : "border-border hover:border-border-strong hover:bg-surface",
                  )}
                >
                  <div className="relative h-11 w-11 shrink-0">
                    <PieceThumb
                      size={p.size}
                      media={p.media?.[0]}
                      count={p.media?.length}
                      showBadge={false}
                      plain
                      className="h-11 w-11"
                    >
                      {!p.media?.length && (
                        <span className="absolute bottom-1 left-1 flex h-[18px] w-[18px] items-center justify-center rounded-mark bg-black/60">
                          <FormatIcon size={11} className="text-fg-soft" />
                        </span>
                      )}
                    </PieceThumb>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[13px] font-semibold text-fg-soft">{p.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                      {(batch.stage ?? "em-aprovacao") === "rascunho" && (
                        <span
                          className="flex items-center gap-1.5 rounded-pill px-2 py-[3px] text-[10px] font-semibold"
                          style={{
                            backgroundColor: "var(--color-draft-badge)",
                            color: "var(--color-draft-dot)",
                          }}
                        >
                          <span
                            className="h-[6px] w-[6px] rounded-full"
                            style={{ backgroundColor: "var(--color-draft-dot)" }}
                          />
                          Rascunho
                        </span>
                      )}
                      {formatLabel(pieceFormat(p))}
                      <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-faint" />
                      {pieceDateLabel(p.date)}
                    </span>
                  </div>

                  <ActionMenu
                    triggerClassName="text-muted hover:bg-border hover:text-fg-soft"
                    items={[
                      {
                        label: "Editar",
                        icon: <PencilIcon size={14} />,
                        onSelect: () => void openPiece(p),
                      },
                      {
                        label: "Ver o lote",
                        icon: <ExternalLinkIcon size={14} />,
                        onSelect: () => router.push(`/social/${clientSlug}/${batch.id}`),
                      },
                    ]}
                  />
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

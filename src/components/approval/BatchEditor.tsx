"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  Batch,
  Piece,
  PieceChannel,
  PieceFormat,
} from "@/lib/approval/types";
import {
  CAPTION_LIMIT,
  PIECE_CHANNELS,
  PIECE_FORMATS,
  batchStage,
  pieceChannel,
  pieceFormat,
  pieceFormatLabel,
} from "@/lib/approval/constants";
import {
  formatAgo,
  formatPieceDate,
  formatPostDate,
  handleFromClient,
  toDatetimeLocal,
} from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { MediaDropzone } from "./MediaDropzone";
import { PieceThumb } from "./PieceThumb";
import { formatBytes } from "@/lib/media/constants";
import { cn } from "@/lib/cn";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  CloudUploadIcon,
  EllipsisIcon,
  FacebookIcon,
  HashIcon,
  HeartIcon,
  ImageIcon,
  InfoIcon,
  InstagramIcon,
  MessageCircleIcon,
  Music2Icon,
  PlusIcon,
  ReplaceIcon,
  SendIcon,
  TrashIcon,
} from "@/components/icons";

/*
 * Editor de lote — fiel ao export "Clínica Aurora - Editor de Lote":
 * peças à esquerda, detalhes no centro, preview do post à direita.
 *
 * O rascunho salva sozinho (debounce) e a barra de topo mostra quando gravou.
 *
 * As artes são reais: "Subir artes" cria uma peça por arquivo (nome, tamanho e
 * formato saem do próprio arquivo) e cada peça pode trocar ou remover a sua
 * arte pelo preview. Sem arte, a peça continua no placeholder do `PieceThumb`.
 */

const CHANNEL_ICON = {
  instagram: InstagramIcon,
  tiktok: Music2Icon,
  facebook: FacebookIcon,
} as const;

const AUTOSAVE_MS = 900;

export function BatchEditor({
  batch: initialBatch,
  initialPieceId,
}: {
  batch: Batch;
  initialPieceId?: string;
}) {
  const { toast } = useToast();
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const [selectedId, setSelectedId] = useState<string>(
    initialPieceId && initialBatch.pieces.some((p) => p.id === initialPieceId)
      ? initialPieceId
      : (initialBatch.pieces[0]?.id ?? ""),
  );
  const [savedAt, setSavedAt] = useState<string | undefined>(
    initialBatch.draftSavedAt,
  );
  const [saving, setSaving] = useState(false);
  /** Quantos arquivos estão subindo agora — trava a dropzone e mostra o spinner. */
  const [uploading, setUploading] = useState(0);
  const [, setTick] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const piece = batch.pieces.find((p) => p.id === selectedId) ?? batch.pieces[0];
  const index = batch.pieces.findIndex((p) => p.id === piece?.id);
  const stage = batchStage(batch);
  const handle = batch.handle ?? handleFromClient(batch.client);

  // Mantém o "salvo há X min" vivo sem recarregar a página.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const persist = useCallback(
    async (pieceId: string, patch: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/batches/${batch.id}/pieces/${pieceId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao salvar.");
        const data = (await res.json()) as { batch: Batch; piece: Piece };
        setSavedAt(data.batch.draftSavedAt);
        setBatch((b) => ({
          ...b,
          draftSavedAt: data.batch.draftSavedAt,
          pieces: b.pieces.map((p) => (p.id === data.piece.id ? data.piece : p)),
        }));
      } catch (e) {
        toast(e instanceof Error ? e.message : "Falha ao salvar.", "error");
      } finally {
        setSaving(false);
      }
    },
    [batch.id, toast],
  );

  /** Atualiza local na hora e agenda a gravação (um timer por peça). */
  function edit(patch: Partial<Piece>, opts?: { now?: boolean }) {
    if (!piece) return;
    const id = piece.id;
    setBatch((b) => ({
      ...b,
      pieces: b.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    const run = () => {
      timers.current.delete(id);
      void persist(id, patch as Record<string, unknown>);
    };
    if (opts?.now) run();
    else timers.current.set(id, setTimeout(run, AUTOSAVE_MS));
  }

  // Grava o que estiver pendente ao sair da tela.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  async function saveNow() {
    if (!piece) return;
    const t = timers.current.get(piece.id);
    if (t) clearTimeout(t);
    timers.current.delete(piece.id);
    await persist(piece.id, {
      caption: piece.caption ?? "",
      hashtags: piece.hashtags ?? "",
      format: pieceFormat(piece),
      channel: pieceChannel(piece),
      date: piece.date,
    });
    toast("Rascunho salvo.");
  }

  async function addPiece() {
    try {
      const res = await fetch(`/api/batches/${batch.id}/pieces`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao criar peça.");
      const { piece: created } = (await res.json()) as { piece: Piece };
      setBatch((b) => ({ ...b, pieces: [...b.pieces, created], stage: "rascunho" }));
      setSelectedId(created.id);
      toast("Peça adicionada ao lote.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao criar peça.", "error");
    }
  }

  /** "Subir artes": uma peça por arquivo, com a arte já anexada. */
  async function uploadArts(files: File[]) {
    setUploading((n) => n + files.length);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const res = await fetch(`/api/batches/${batch.id}/pieces`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao subir as artes.");

      const created = data.pieces as Piece[];
      const rejected = (data.rejected ?? []) as { name: string; error: string }[];
      setBatch((b) => ({ ...b, pieces: [...b.pieces, ...created], stage: "rascunho" }));
      if (created[0]) setSelectedId(created[0].id);

      toast(
        created.length === 1
          ? "Arte adicionada ao lote."
          : `${created.length} artes adicionadas ao lote.`,
      );
      // O que não passou avisa em separado, com o motivo do arquivo.
      for (const r of rejected) toast(`${r.name}: ${r.error}`, "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao subir as artes.", "error");
    } finally {
      setUploading((n) => Math.max(0, n - files.length));
    }
  }

  /** Troca a arte da peça aberta. */
  async function replaceArt(file: File) {
    if (!piece) return;
    const pieceId = piece.id;
    setUploading((n) => n + 1);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/batches/${batch.id}/pieces/${pieceId}/media`,
        { method: "POST", body: form },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao trocar a arte.");
      applyPiece(data as { batch: Batch; piece: Piece });
      toast("Arte atualizada.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao trocar a arte.", "error");
    } finally {
      setUploading((n) => Math.max(0, n - 1));
    }
  }

  /** Remove a arte da peça — volta ao placeholder, a peça continua no lote. */
  async function removeArt() {
    if (!piece?.media) return;
    const pieceId = piece.id;
    try {
      const res = await fetch(
        `/api/batches/${batch.id}/pieces/${pieceId}/media`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Falha ao remover a arte.");
      applyPiece(data as { batch: Batch; piece: Piece });
      toast("Arte removida.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao remover a arte.", "error");
    }
  }

  /** Aplica a peça que voltou do servidor (mídia mexe em size/format/kind). */
  function applyPiece(data: { batch: Batch; piece: Piece }) {
    setSavedAt(data.batch.draftSavedAt);
    setBatch((b) => ({
      ...b,
      draftSavedAt: data.batch.draftSavedAt,
      pieces: b.pieces.map((p) => (p.id === data.piece.id ? data.piece : p)),
    }));
  }

  async function sendForApproval() {
    try {
      const res = await fetch(`/api/batches/${batch.id}/send`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao enviar.");
      const { batch: updated } = (await res.json()) as { batch: Batch };
      setBatch(updated);
      setSavedAt(updated.draftSavedAt);
      toast("Lote enviado para aprovação.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao enviar.", "error");
    }
  }

  const captionLength = piece?.caption?.length ?? 0;

  const hashtagsPreview = useMemo(
    () =>
      (piece?.hashtags ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((h) => "#" + h.replace(/^#/, ""))
        .join(" "),
    [piece?.hashtags],
  );

  if (!piece) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-[15px] font-semibold text-fg-soft">Lote sem peças</p>
        <button
          type="button"
          onClick={addPiece}
          className="rounded-pill bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary"
        >
          Adicionar peça
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 py-6 pl-2 pr-6">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media", href: "/social" },
          { label: batch.client, href: `/social/${batch.id}` },
          { label: batch.label },
          { label: "Editor" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Link
            href={`/social/${batch.id}`}
            aria-label="Voltar para o lote"
            className="flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-surface-2 text-fg-soft transition-colors hover:bg-surface"
          >
            <ChevronLeftIcon size={16} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[20px] font-semibold text-fg-soft">Editor de lote</h1>
            <p className="text-[12px] text-muted">
              {batch.client} · {batch.label} · Peça {String(index + 1).padStart(2, "0")} de{" "}
              {batch.pieces.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 py-2 text-[12px] text-fg-2">
            <span
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                stage === "rascunho" ? "bg-muted" : "bg-primary",
              )}
            />
            {stage === "rascunho" ? "Rascunho" : "Em aprovação"}
            {saving ? " · salvando…" : savedAt ? ` · salvo ${formatAgo(savedAt)}` : ""}
          </span>
          <button
            type="button"
            onClick={saveNow}
            className="rounded-field border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-fg-soft transition-colors hover:bg-surface-2"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={sendForApproval}
            className="flex items-center gap-2 rounded-field bg-primary px-4 py-2.5 text-[14px] font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <SendIcon size={15} /> Enviar para aprovação
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Peças do lote */}
        <section className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
              /PEÇAS DO LOTE
            </h2>
            <span className="rounded-pill bg-border px-2.5 py-[3px] text-[11px] font-semibold text-fg-soft">
              {batch.pieces.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            <MediaDropzone
              multiple
              disabled={uploading > 0}
              onFiles={uploadArts}
              className="flex w-full flex-col items-center gap-1.5 rounded-panel border border-border-strong bg-surface px-4 py-[18px] text-center hover:bg-surface/60"
            >
              {uploading > 0 ? (
                <Spinner size={18} className="text-fg-3" />
              ) : (
                <CloudUploadIcon size={18} className="text-fg-3" />
              )}
              <span className="text-[13px] font-semibold text-fg-soft">
                {uploading > 0
                  ? uploading === 1
                    ? "Subindo 1 arte…"
                    : `Subindo ${uploading} artes…`
                  : "Subir artes"}
              </span>
              <span className="text-[11px] text-dim">
                Arraste aqui · PNG, JPG ou MP4 · até 50 MB
              </span>
            </MediaDropzone>

            {batch.pieces.map((p) => {
              const active = p.id === piece.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-panel p-2.5 text-left transition-colors",
                    active ? "bg-border" : "hover:bg-surface",
                  )}
                >
                  <PieceThumb
                    size={p.size}
                    media={p.media}
                    showBadge={false}
                    plain
                    className={cn(
                      "h-11 w-11 shrink-0 border",
                      active ? "border-dim" : "border-border",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-semibold text-fg-soft">
                      {p.name}
                    </span>
                    <span className="truncate text-[11px] text-muted">
                      {pieceFormatLabel(p)} · {formatPieceDate(p.date)}
                    </span>
                  </span>
                  {p.status === "aprovado" ? (
                    <CheckIcon size={14} className="text-fg-3" />
                  ) : (
                    <span
                      className={cn(
                        "h-[7px] w-[7px] shrink-0 rounded-full",
                        active ? "bg-primary" : "bg-dim",
                      )}
                    />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={addPiece}
              className="flex items-center gap-2 rounded-panel px-3 py-2.5 text-[12px] font-medium text-muted transition-colors hover:text-fg-soft"
            >
              <PlusIcon size={14} /> Adicionar peça
            </button>
          </div>
        </section>

        {/* Detalhes da peça */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
              /DETALHES DA PEÇA
            </h2>
            <span className="rounded-pill border border-border bg-surface px-3 py-1 text-[12px] font-semibold text-fg-soft">
              {piece.name}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto p-5">
            <div className="flex flex-wrap gap-3.5">
              <Field label="DATA DE PUBLICAÇÃO" className="min-w-[220px] flex-1">
                <label className="flex items-center gap-2 rounded-panel border border-border bg-surface px-3.5 py-3">
                  <CalendarIcon size={15} className="text-muted" />
                  <input
                    type="datetime-local"
                    value={toDatetimeLocal(piece.date)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      edit({ date: new Date(v).toISOString() });
                    }}
                    className="w-full bg-transparent text-[13px] text-fg-soft focus:outline-none [color-scheme:dark]"
                  />
                </label>
              </Field>

              <Field label="FORMATO" className="min-w-[240px] flex-1">
                <div className="flex flex-wrap gap-2">
                  {PIECE_FORMATS.map((f) => (
                    <Chip
                      key={f.id}
                      active={pieceFormat(piece) === f.id}
                      onClick={() => edit({ format: f.id as PieceFormat }, { now: true })}
                    >
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="CANAL">
              <div className="flex flex-wrap gap-2">
                {PIECE_CHANNELS.map((c) => {
                  const Icon = CHANNEL_ICON[c.id];
                  return (
                    <Chip
                      key={c.id}
                      active={pieceChannel(piece) === c.id}
                      onClick={() => edit({ channel: c.id as PieceChannel }, { now: true })}
                      padded
                    >
                      <Icon size={14} />
                      {c.label}
                    </Chip>
                  );
                })}
              </div>
            </Field>

            <Field
              label="LEGENDA"
              right={`${captionLength.toLocaleString("pt-BR")} / ${CAPTION_LIMIT.toLocaleString("pt-BR")}`}
              className="min-h-[180px] flex-1"
            >
              <textarea
                value={piece.caption ?? ""}
                maxLength={CAPTION_LIMIT}
                onChange={(e) => edit({ caption: e.target.value })}
                placeholder="Escreva a legenda que o cliente vai aprovar…"
                className="h-full min-h-[150px] w-full resize-none rounded-panel border border-border bg-surface p-3.5 text-[13px]/[21px] text-fg-soft placeholder:text-faint focus:border-border-strong focus:outline-none"
              />
            </Field>

            <Field label="HASHTAGS">
              <label className="flex items-center gap-2 rounded-panel border border-border bg-surface px-3.5 py-3">
                <HashIcon size={15} className="text-muted" />
                <input
                  value={piece.hashtags ?? ""}
                  onChange={(e) => edit({ hashtags: e.target.value })}
                  placeholder="clinicaaurora skincare pele glow"
                  className="w-full bg-transparent text-[13px] text-fg-soft placeholder:text-faint focus:outline-none"
                />
              </label>
            </Field>
          </div>
        </section>

        {/* Preview do post */}
        <section className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[12px] font-semibold tracking-[0.3px] text-muted">
              /PREVIEW DO POST
            </h2>
            {(() => {
              const Icon = CHANNEL_ICON[pieceChannel(piece)];
              return <Icon size={15} className="text-fg-3" />;
            })()}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto p-4">
            <article className="overflow-hidden rounded-panel border border-border bg-bg">
              <header className="flex items-center gap-2.5 p-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-border-strong text-[12px] font-semibold text-fg">
                  {batch.client.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] font-semibold text-fg-soft">
                    {handle}
                  </span>
                  <span className="truncate text-[10px] text-muted">
                    {pieceFormatLabel(piece)} · {piece.size}
                  </span>
                </span>
                <EllipsisIcon size={14} className="text-fg-3" />
              </header>

              {piece.media ? (
                <div className="group/art relative">
                  <PieceThumb
                    size={piece.size}
                    media={piece.media}
                    showBadge={false}
                    className="h-[250px] w-full rounded-none border-0 bg-black"
                    contain
                  />
                  {/* Trocar/remover aparecem sobre a arte, no hover. */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover/art:opacity-100 focus-within:opacity-100">
                    <span className="truncate text-[10px] text-fg-3">
                      {formatBytes(piece.media.size)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <MediaDropzone
                        disabled={uploading > 0}
                        onFiles={(files) => files[0] && replaceArt(files[0])}
                        className="flex items-center gap-1.5 rounded-pill bg-black/70 px-2.5 py-1.5 text-[11px] text-fg-soft backdrop-blur-sm hover:bg-black/90"
                      >
                        <ReplaceIcon size={12} /> Trocar
                      </MediaDropzone>
                      <button
                        type="button"
                        onClick={removeArt}
                        aria-label="Remover arte"
                        className="tap flex items-center rounded-pill bg-black/70 p-1.5 text-fg-soft backdrop-blur-sm transition-colors hover:bg-black/90"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </span>
                  </div>
                </div>
              ) : (
                <MediaDropzone
                  disabled={uploading > 0}
                  onFiles={(files) => files[0] && replaceArt(files[0])}
                  className="flex h-[250px] w-full flex-col items-center justify-center gap-2 bg-surface text-dim hover:bg-surface-2"
                >
                  {uploading > 0 ? <Spinner size={22} /> : <ImageIcon size={22} />}
                  <span className="text-[11px]">
                    {piece.size.replace(" x ", " × ")}
                  </span>
                  <span className="text-[10px] text-faint">
                    Clique ou arraste a arte desta peça
                  </span>
                </MediaDropzone>
              )}

              <div className="flex items-center gap-3 px-3 pb-1 pt-2.5 text-fg-soft">
                <HeartIcon size={16} />
                <MessageCircleIcon size={16} />
                <SendIcon size={16} />
                <span className="flex flex-1 justify-end">
                  <BookmarkIcon size={16} />
                </span>
              </div>

              <div className="flex flex-col gap-1.5 px-3 pb-3.5 pt-1.5">
                <p className="text-[11px] font-semibold text-fg-soft">
                  Curtido por ana.paula e outras 128 pessoas
                </p>
                <p className="line-clamp-4 text-[11px]/[17px] text-fg-2">
                  <span className="font-semibold text-fg-soft">{handle}</span>{" "}
                  {piece.caption?.trim()
                    ? piece.caption
                    : "A legenda aparece aqui assim que você escrever."}{" "}
                  {hashtagsPreview && (
                    <span className="text-muted">{hashtagsPreview}</span>
                  )}
                </p>
                <p className="text-[11px] text-dim">Ver todos os 12 comentários</p>
                <p className="text-[9px] tracking-[0.5px] text-dim">
                  {formatPostDate(piece.date)}
                </p>
              </div>
            </article>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-border px-5 py-3">
            <InfoIcon size={13} className="text-dim" />
            <span className="text-[11px] text-dim">
              Preview aproximado do {PIECE_CHANNELS.find((c) => c.id === pieceChannel(piece))?.label}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  right,
  className,
  children,
}: {
  label: string;
  right?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[0.3px] text-muted">
          {label}
        </span>
        {right && <span className="text-[11px] text-dim">{right}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  padded,
  children,
}: {
  active: boolean;
  onClick: () => void;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-pill text-[12px] transition-colors",
        padded ? "px-4 py-2.5" : "px-3 py-2",
        active
          ? "bg-primary font-semibold text-on-primary"
          : "border border-border bg-surface text-fg-2 hover:border-border-strong",
      )}
    >
      {children}
    </button>
  );
}

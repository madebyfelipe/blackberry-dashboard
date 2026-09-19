"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, Piece } from "@/lib/approval/types";
import {
  CAPTION_LIMIT,
  PIECE_CHANNELS,
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
} from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { ActionMenu } from "@/components/tasks/ActionMenu";
import { MediaDropzone } from "./MediaDropzone";
import { PieceThumb } from "./PieceThumb";
import { Popover } from "./Popover";
import { RoundIconButton } from "./RoundIconButton";
import { ScreenHeader } from "./ScreenHeader";
import { PiecePropertiesMenu } from "./PiecePropertiesMenu";
import { formatBytes } from "@/lib/media/constants";
import { cn } from "@/lib/cn";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  CloudUploadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FacebookIcon,
  HashIcon,
  HeartIcon,
  ImageIcon,
  InstagramIcon,
  MessageCircleIcon,
  Music2Icon,
  PlusIcon,
  ReplaceIcon,
  SendIcon,
  Settings2Icon,
  TrashIcon,
} from "@/components/icons";

/*
 * Editor de lote.
 *
 * O desenho do export "Clínica Aurora - Editor de Lote" trazia três painéis com
 * borda, fundo e cabeçalho próprio. Aqui eles viraram três áreas soltas no
 * fundo preto, separadas por uma linha de 1px — a mesma filosofia da tela de
 * Lote e das Tarefas: fundo primeiro, o mínimo de molduras, e o que não é
 * urgente recolhido em botão (data, formato e canal moram em "Propriedades da
 * peça"; salvar agora e adicionar peça, no menu de ações).
 *
 * O rascunho salva sozinho (debounce) e o cabeçalho mostra quando gravou.
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
  const router = useRouter();
  const [batch, setBatch] = useState<Batch>(initialBatch);
  /** Qual menu do cabeçalho está aberto (só um por vez). */
  const [menu, setMenu] = useState<"propriedades" | null>(null);
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
          className="tap rounded-pill bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary"
        >
          Adicionar peça
        </button>
      </div>
    );
  }

  const ChannelIcon = CHANNEL_ICON[pieceChannel(piece)];
  const channelLabel =
    PIECE_CHANNELS.find((c) => c.id === pieceChannel(piece))?.label ?? "Instagram";

  return (
    <div className="flex h-full min-h-0 flex-col gap-[22px] py-5 pl-2 pr-7">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media", href: "/social" },
          { label: batch.client, href: `/social/${batch.id}` },
          { label: batch.label },
          { label: "Editor" },
        ]}
      />

      {/*
       * Mesmo cabeçalho do lote: título de 24px, linha de apoio de 13px e
       * botões redondos de 40px. Só "Enviar para aprovação" fica como pílula —
       * o resto (salvar agora, adicionar peça, voltar ao lote) mora no menu.
       */}
      <ScreenHeader
        title="Editor de lote"
        subtitle={
          <>
            {batch.client} · {batch.label} · Peça{" "}
            {String(index + 1).padStart(2, "0")} de {batch.pieces.length}
          </>
        }
        leading={
          <RoundIconButton
            href={`/social/${batch.id}`}
            label="Voltar para o lote"
          >
            <ChevronLeftIcon size={18} />
          </RoundIconButton>
        }
      >
        {/*
         * Estado do rascunho: só o ponto e o texto, sem pílula em volta — é
         * informação de fundo, não um botão.
         */}
        <span className="flex items-center gap-1.5 pr-1 text-[12px] text-muted">
          <span
            className={cn(
              "h-[7px] w-[7px] rounded-full",
              stage === "rascunho" ? "bg-dim" : "bg-primary animate-breathe",
            )}
            aria-hidden="true"
          />
          <span aria-live="polite">
            {stage === "rascunho" ? "Rascunho" : "Em aprovação"}
            {saving ? " · salvando…" : savedAt ? ` · salvo ${formatAgo(savedAt)}` : ""}
          </span>
        </span>

        {/* Propriedades da peça — data, formato e canal saíram da tela. */}
        <Popover
          open={menu === "propriedades"}
          onClose={() => setMenu(null)}
          trigger={
            <RoundIconButton
              label="Propriedades da peça"
              expanded={menu === "propriedades"}
              active={menu === "propriedades"}
              onClick={() =>
                setMenu((m) => (m === "propriedades" ? null : "propriedades"))
              }
            >
              <Settings2Icon size={18} />
            </RoundIconButton>
          }
        >
          <PiecePropertiesMenu piece={piece} onChange={edit} />
        </Popover>

        <ActionMenu
          triggerClassName="h-10 w-10 bg-surface text-fg-soft hover:bg-surface-2"
          menuClassName="w-[208px]"
          items={[
            {
              label: "Salvar rascunho",
              icon: <CheckIcon size={15} />,
              onSelect: () => void saveNow(),
            },
            {
              label: "Ver o lote",
              icon: <ExternalLinkIcon size={15} />,
              divider: true,
              onSelect: () => router.push(`/social/${batch.id}`),
            },
          ]}
        />

        <button
          type="button"
          onClick={sendForApproval}
          className="tap flex h-10 shrink-0 items-center gap-2 rounded-pill bg-primary px-5 text-[14px] font-semibold text-[#111111] transition-colors hover:bg-white"
        >
          <SendIcon size={16} /> Enviar para aprovação
        </button>
      </ScreenHeader>

      {/*
       * Corpo sem painéis: três áreas soltas no fundo, separadas por uma linha
       * de 1px — o mesmo recurso que o lote usa no painel de detalhe. No
       * celular elas empilham e a tira de peças rola na horizontal.
       */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:flex-row lg:gap-0 lg:overflow-hidden">
        {/* Peças do lote */}
        <aside className="flex shrink-0 flex-col gap-3 lg:w-[212px] lg:min-h-0 lg:border-r lg:border-border lg:pr-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-[1.5px] text-muted">
              PEÇAS
            </span>
            <span className="text-[11px] text-dim">
              {String(batch.pieces.length).padStart(2, "0")}
            </span>
          </div>

          <div className="flex min-h-0 gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
            {batch.pieces.map((p, i) => {
              const active = p.id === piece.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setSelectedId(p.id)}
                  style={{ ["--d" as string]: i }}
                  className="stagger-item tap group flex w-[132px] shrink-0 flex-col gap-2 text-left lg:w-auto lg:flex-row lg:items-center lg:gap-3"
                >
                  <PieceThumb
                    size={p.size}
                    media={p.media}
                    showBadge={false}
                    plain
                    className={cn(
                      "h-[80px] w-full shrink-0 transition-all duration-200 lg:h-10 lg:w-10",
                      active
                        ? "outline outline-1 -outline-offset-[0.5px] outline-fg-soft"
                        : "outline outline-1 -outline-offset-[0.5px] outline-transparent group-hover:outline-border-strong",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-[12px] font-semibold transition-colors",
                          active ? "text-fg" : "text-fg-3 group-hover:text-fg-soft",
                        )}
                      >
                        {p.name}
                      </span>
                      {/*
                       * Colado no nome (e não na ponta da linha) porque na tira
                       * horizontal do celular a linha vira coluna e o ícone
                       * caía sozinho embaixo do card.
                       */}
                      {p.status === "aprovado" && (
                        <CheckIcon
                          size={13}
                          aria-label="Peça aprovada"
                          className="shrink-0 text-fg-3"
                        />
                      )}
                    </span>
                    <span className="truncate text-[11px] text-dim">
                      {pieceFormatLabel(p)} · {formatPieceDate(p.date)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {/*
             * A dropzone continua visível porque é alvo de arrastar: sem uma
             * área marcada, não há para onde soltar o arquivo. Mas perdeu o
             * fundo — ficou um contorno tracejado sobre o preto.
             */}
            <MediaDropzone
              multiple
              disabled={uploading > 0}
              onFiles={uploadArts}
              activeClassName="border-fg-3 border-solid bg-surface"
              className="flex w-full items-center justify-center gap-2 rounded-panel border border-dashed border-border px-3 py-3 text-center hover:border-border-strong"
            >
              {uploading > 0 ? (
                <Spinner size={15} className="text-fg-3" />
              ) : (
                <CloudUploadIcon size={15} className="text-fg-3" />
              )}
              <span className="text-[12px] font-medium text-fg-soft">
                {uploading > 0
                  ? uploading === 1
                    ? "Subindo 1 arte…"
                    : `Subindo ${uploading} artes…`
                  : "Subir artes"}
              </span>
            </MediaDropzone>
            <button
              type="button"
              onClick={addPiece}
              className="tap flex items-center gap-1.5 text-[12px] text-muted transition-colors hover:text-fg-soft"
            >
              <PlusIcon size={13} /> Adicionar peça vazia
            </button>
          </div>
        </aside>

        {/* O que se edita: legenda e hashtags */}
        <section className="flex w-full shrink-0 flex-col gap-3 lg:min-h-0 lg:w-auto lg:min-w-0 lg:flex-1 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="truncate text-[16px] font-bold text-fg">{piece.name}</h2>
            {/*
             * Os metadados continuam em cena como texto — quem quiser mudá-los
             * abre "Propriedades da peça" no cabeçalho.
             */}
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <ChannelIcon size={13} />
              {pieceFormatLabel(piece)} · {channelLabel} ·{" "}
              {formatPieceDate(piece.date)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="piece-caption"
              className="font-mono text-[10px] tracking-[1.5px] text-muted"
            >
              LEGENDA
            </label>
            <span className="text-[11px] text-dim">
              {captionLength.toLocaleString("pt-BR")} /{" "}
              {CAPTION_LIMIT.toLocaleString("pt-BR")}
            </span>
          </div>
          {/*
           * A caixa cresce até um teto: sem ele, esticava até o pé da tela e
           * voltava a ser a moldura gigante que o redesenho tirou.
           */}
          <textarea
            id="piece-caption"
            value={piece.caption ?? ""}
            maxLength={CAPTION_LIMIT}
            onChange={(e) => edit({ caption: e.target.value })}
            placeholder="Escreva a legenda que o cliente vai aprovar…"
            className="max-h-[420px] min-h-[200px] w-full flex-1 resize-none rounded-panel border border-border bg-transparent p-3.5 text-[13px]/[21px] text-fg-soft placeholder:text-faint focus:border-border-strong focus:outline-none"
          />

          <label
            htmlFor="piece-hashtags"
            className="font-mono text-[10px] tracking-[1.5px] text-muted"
          >
            HASHTAGS
          </label>
          <div className="flex shrink-0 items-center gap-2 rounded-panel border border-border bg-transparent px-3.5 py-3 focus-within:border-border-strong">
            <HashIcon size={15} className="text-muted" />
            <input
              id="piece-hashtags"
              value={piece.hashtags ?? ""}
              onChange={(e) => edit({ hashtags: e.target.value })}
              placeholder="clinicaaurora skincare pele glow"
              className="w-full bg-transparent text-[13px] text-fg-soft placeholder:text-faint focus:outline-none"
            />
          </div>
        </section>

        {/* Preview do post */}
        <aside className="flex w-full shrink-0 flex-col gap-3 pb-2 lg:w-[312px] lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-border lg:pl-6">
          <span className="font-mono text-[10px] tracking-[1.5px] text-muted">
            PREVIEW · {channelLabel.toUpperCase()}
          </span>

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
                {/* Trocar/remover aparecem sobre a arte, no hover ou no foco. */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-2.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/art:opacity-100">
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
                <span className="text-[11px]">{piece.size.replace(" x ", " × ")}</span>
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

          <span className="text-[11px] text-dim">
            Preview aproximado do {channelLabel}
          </span>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, Piece, PieceStatus } from "@/lib/approval/types";
import {
  batchLinkStatus,
  batchProgress,
  pieceChannel,
  pieceFormatLabel,
  PIECE_CHANNELS,
  PIECE_STATUS,
} from "@/lib/approval/constants";
import { formatPieceDate } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Screen, ScreenAction, ScreenHeader, ScreenIconAction } from "@/components/ui/Screen";
import { TabStrip } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { PieceThumb } from "./PieceThumb";
import { ScrollFade } from "./ScrollFade";
import { useToast } from "@/components/ui/Toast";
import { CopyIcon, PencilIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Filter = "todas" | PieceStatus;

/**
 * Lote (visão agência) — export "Clínica Aurora - Lote".
 *
 * Topo minimalista: trilha à esquerda, link público à direita, e nada mais.
 * Saíram daqui o título grande, o resumo de progresso e os botões redondos de
 * filtro/busca; as ações do link (WhatsApp, e-mail, copiar mensagem, gerar e
 * desativar) passaram para o menu do Editor de lote. O que sobrou na tela é o
 * que o desenho pede: chips de status, grade de peças e painel de detalhe.
 */
export function LoteView({
  initialBatch,
  clientSlug,
}: {
  initialBatch: Batch;
  clientSlug: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(
    initialBatch.pieces.find((p) => p.status === "ajuste")?.id ??
      initialBatch.pieces[0]?.id ??
      "",
  );

  const progress = batchProgress(batch);
  /*
   * O link precisa ser o do ambiente em que o time está (localhost, preview da
   * Vercel ou produção) — senão copiar/compartilhar manda o cliente para um
   * domínio que talvez nem exista ainda. No servidor cai no domínio final.
   */
  const [origin, setOrigin] = useState("https://app.blackberry.com.br");
  useEffect(() => setOrigin(window.location.origin), []);
  const publicUrl = `${origin}/a/${batch.token}`;
  const linkStatus = batchLinkStatus(batch);

  const filtered = useMemo(
    () =>
      filter === "todas"
        ? batch.pieces
        : batch.pieces.filter((p) => p.status === filter),
    [batch, filter],
  );

  const selected = batch.pieces.find((p) => p.id === selectedId);

  async function copyLink() {
    if (linkStatus !== "ativo") {
      toast("O link está inativo. Gere um novo no editor do lote.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("Link copiado.");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  /** "Aprovar peça" / "Marcar como refeita" — as duas ações do painel. */
  async function pieceAction(piece: Piece, action: "approve" | "redo") {
    const prev = batch;
    const optimistic: PieceStatus = action === "approve" ? "aprovado" : "pendente";
    setBusy(true);
    setBatch((b) => ({
      ...b,
      pieces: b.pieces.map((p) =>
        p.id === piece.id ? { ...p, status: optimistic, reason: undefined } : p,
      ),
    }));
    try {
      const res = await fetch(
        `/api/batches/${batch.id}/pieces/${piece.id}/${action}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      const { piece: updated } = await res.json();
      setBatch((b) => ({
        ...b,
        pieces: b.pieces.map((p) => (p.id === updated.id ? updated : p)),
      }));
      toast(action === "approve" ? "Peça aprovada." : "Peça marcada como refeita.");
    } catch {
      setBatch(prev);
      toast("Não foi possível atualizar.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Rótulos e ordem vêm do export "Clínica Aurora - Lote".
  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "todas", label: "Todas", count: progress.total },
    { id: "ajuste", label: "Ajuste", count: progress.ajuste },
    { id: "aprovado", label: "Aprovado", count: progress.aprovadas },
    { id: "pendente", label: "Pendente", count: progress.pendentes },
  ];

  return (
    <Screen gap="md">
      <Breadcrumb
        items={[
          { label: "black berry", href: "/tarefas" },
          { label: "Social media", href: "/social" },
          { label: batch.client, href: `/social/${clientSlug}` },
          { label: batch.label },
        ]}
      />

      <ScreenHeader
        actions={
          <>
            {/*
             * Quando o link não está valendo, a URL copiada não levaria a
             * lugar nenhum — o selo diz por quê.
             */}
            {linkStatus !== "ativo" && <Badge label={`Link ${linkStatus}`} size="md" />}
            <span className="hidden max-w-[260px] truncate rounded-mark border border-panel-ring bg-surface-2 px-3.5 py-2.5 text-[12px] text-fg-3 xl:block">
              {publicUrl}
            </span>
            <ScreenAction onClick={copyLink}>
              <CopyIcon size={14} className="mr-2" />
              Copiar link
            </ScreenAction>
            <ScreenIconAction
              label="Editar lote"
              onClick={() => router.push(`/social/${clientSlug}/${batch.id}/planejamento`)}
            >
              <PencilIcon size={15} />
            </ScreenIconAction>
          </>
        }
      >
        <TabStrip
          tabs={chips.map((c) => ({ id: c.id, label: c.label, count: c.count }))}
          active={filter}
          onSelect={(id) => setFilter(id as Filter)}
        />
      </ScreenHeader>

      {/*
       * Body — no desktop as duas colunas rolam por dentro; no celular elas
       * empilham e quem rola é o corpo inteiro (com `flex-1` em cada uma, a
       * grade era espremida até sumir numa tela de 390px).
       */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto lg:flex-row lg:gap-0 lg:overflow-hidden">
        {/* Grade de peças */}
        <ScrollFade
          wrapperClassName="shrink-0 lg:flex-1"
          className="overflow-x-hidden pt-1 lg:overflow-y-auto lg:pr-6"
        >
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">
              Nenhuma peça com esses filtros.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  style={{ ["--d" as string]: i }}
                  className="stagger-item tap group flex flex-col gap-2 text-left"
                >
                  {/*
                   * Anel de seleção como box-shadow `inset`: a miniatura tem
                   * `overflow-hidden` + canto arredondado (é o que recorta a
                   * arte), e `outline` tem um clip calculado à parte do
                   * recorte do overflow — a costura entre os dois cortava
                   * uma lasca do anel nas colunas do meio da grade.
                   */}
                  <PieceThumb
                    size={p.size}
                    media={p.media?.[0]}
                    count={p.media?.length}
                    status={p.status}
                    className={cn(
                      "h-[130px] w-full transition-all duration-200 group-hover:-translate-y-0.5",
                      selectedId === p.id
                        ? "shadow-[inset_0_0_0_1px_var(--color-fg-soft)]"
                        : "group-hover:shadow-[inset_0_0_0_1px_var(--color-border-strong)]",
                    )}
                  />
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-fg-soft">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">
                      {formatPieceDate(p.date)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollFade>

        {/* Painel de detalhe */}
        <ScrollFade
          wrapperClassName="w-full shrink-0 lg:w-[300px]"
          className="flex flex-col gap-[18px] overflow-x-hidden pt-1 lg:overflow-y-auto lg:border-l lg:border-border lg:pl-6"
        >
          {selected ? (
            <DetailPanel
              piece={selected}
              busy={busy}
              onApprove={() => pieceAction(selected, "approve")}
              onRedo={() => pieceAction(selected, "redo")}
              onEditor={() =>
                router.push(
                  `/social/${clientSlug}/${batch.id}/editor?peca=${selected.id}`,
                )
              }
            />
          ) : (
            <p className="text-[13px] text-muted">
              Selecione uma peça para ver os detalhes.
            </p>
          )}
        </ScrollFade>
      </div>
    </Screen>
  );
}

function DetailPanel({
  piece,
  busy,
  onApprove,
  onRedo,
  onEditor,
}: {
  piece: Piece;
  busy: boolean;
  onApprove: () => void;
  onRedo: () => void;
  onEditor: () => void;
}) {
  const status = PIECE_STATUS[piece.status];
  const channel =
    PIECE_CHANNELS.find((c) => c.id === pieceChannel(piece))?.label ?? "Instagram";
  // Não há campo de responsável na peça ainda: usa quem assinou a última
  // decisão do histórico.
  const owner = piece.history[0]?.who.split(" · ")[0] ?? "—";

  return (
    <>
      {/* Panel Head */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-[16px] font-bold text-fg">{piece.name}</h2>
        <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 inset-ring-1 inset-ring-border">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: status.dot }}
          />
          <span className="text-[12px] font-medium text-fg-soft">
            {status.label}
          </span>
        </span>
      </div>

      <MetaRow k="Formato" v={piece.size} />
      <MetaRow k="Destino" v={`${pieceFormatLabel(piece)} · ${channel}`} />
      <MetaRow k="Legenda" v={piece.caption?.trim() ? "Preenchida" : "Vazia"} />
      <MetaRow k="Responsável" v={owner} />

      {piece.reason && (
        <p className="border-l border-border-strong pl-3 text-[12px]/[18px] text-fg-2">
          <span className="text-muted">Motivo do ajuste: </span>
          {piece.reason}
        </p>
      )}

      <div className="h-px w-full shrink-0 bg-border" />

      <span className="font-mono text-[10px] tracking-[1.5px] text-muted">
        HISTÓRICO
      </span>

      <div className="flex flex-col gap-[18px]">
        {piece.history.length === 0 && (
          <span className="text-[12px] text-muted">Sem eventos ainda.</span>
        )}
        {piece.history.map((h) => {
          const [who, ...stamp] = h.who.split(" · ");
          return (
            <div key={h.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[12px] text-fg-soft">{h.title}</span>
                <span className="text-[11px] text-muted">
                  {who}
                  {h.ip ? ` · IP ${h.ip}` : ""}
                </span>
              </div>
              <span className="shrink-0 text-[11px] text-muted">
                {stamp.join(" · ")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Panel Actions */}
      <div className="flex flex-1 flex-col justify-end gap-2 pt-2">
        {piece.status === "ajuste" ? (
          <PanelButton onClick={onRedo} disabled={busy} primary>
            Marcar como refeita
          </PanelButton>
        ) : (
          <PanelButton
            onClick={onApprove}
            disabled={busy || piece.status === "aprovado"}
            primary
          >
            {piece.status === "aprovado" ? "Peça aprovada" : "Aprovar peça"}
          </PanelButton>
        )}
        <PanelButton onClick={onEditor}>Abrir no editor</PanelButton>
      </div>
    </>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-muted">{k}</span>
      <span className="truncate text-[12px] font-semibold text-fg-soft">{v}</span>
    </div>
  );
}

function PanelButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full shrink-0 items-center justify-center rounded-pill px-5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-primary text-on-primary hover:bg-white"
          : "text-fg-soft inset-ring-1 inset-ring-border hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

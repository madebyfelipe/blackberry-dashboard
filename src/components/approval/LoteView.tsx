"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, Piece, PieceStatus } from "@/lib/approval/types";
import {
  batchLinkStatus,
  batchProgress,
  pieceChannel,
  pieceFormatLabel,
  shareMessage,
  shareSubject,
  PIECE_CHANNELS,
  PIECE_FORMATS,
  PIECE_STATUS,
} from "@/lib/approval/constants";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PieceThumb } from "./PieceThumb";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/tasks/ActionMenu";
import {
  CopyIcon,
  RotateIcon,
  ExternalLinkIcon,
  XIcon,
  SlidersIcon,
  SearchIcon,
  CheckIcon,
  SendIcon,
  MessageCircleIcon,
  InboxIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

type Filter = "todas" | PieceStatus;

/**
 * Lote (visão agência) — export "Clínica Aurora · Lote".
 * Cabeçalho com título + ações redondas, chips de status, grade de peças à
 * esquerda e painel de detalhe encostado na borda direita.
 */
export function LoteView({ initialBatch }: { initialBatch: Batch }) {
  const { toast } = useToast();
  const router = useRouter();
  const [batch, setBatch] = useState<Batch>(initialBatch);
  const [filter, setFilter] = useState<Filter>("todas");
  const [formatFilter, setFormatFilter] = useState<string[]>([]);
  const [showFormats, setShowFormats] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batch.pieces.filter((p) => {
      if (filter !== "todas" && p.status !== filter) return false;
      if (formatFilter.length && !formatFilter.includes(pieceFormatLabel(p)))
        return false;
      if (q && !`${p.name} ${p.kind} ${p.caption ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [batch, filter, formatFilter, search]);

  const selected = batch.pieces.find((p) => p.id === selectedId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("Link copiado.");
    } catch {
      toast("Não foi possível copiar.", "error");
    }
  }

  /** Abre o WhatsApp/e-mail com a mensagem pronta e o link do lote. */
  function share(channel: "whatsapp" | "email") {
    if (linkStatus !== "ativo") {
      toast("O link está inativo. Gere um novo antes de enviar.", "error");
      return;
    }
    const message = shareMessage(batch, publicUrl);
    const url =
      channel === "whatsapp"
        ? `https://wa.me/?text=${encodeURIComponent(message)}`
        : `mailto:?subject=${encodeURIComponent(shareSubject(batch))}&body=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(shareMessage(batch, publicUrl));
      toast("Mensagem copiada com o link.");
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

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "todas", label: "Todas", count: progress.total },
    { id: "aprovado", label: "Aprovadas", count: progress.aprovadas },
    { id: "ajuste", label: "Ajustes", count: progress.ajuste },
    { id: "pendente", label: "Pendentes", count: progress.pendentes },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-[22px] py-5 pl-2 pr-7">
      <Breadcrumb
        items={[
          { label: batch.client, href: "/social" },
          { label: batch.label },
        ]}
      />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[24px] font-bold text-fg">{batch.label}</h1>
          <p className="text-[13px] text-muted">
            {batch.client} · {progress.total}{" "}
            {progress.total === 1 ? "peça" : "peças"} ·{" "}
            {progress.pendentes} aguardando aprovação
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {linkStatus !== "ativo" && (
            <span className="rounded-pill bg-border-strong px-3 py-1.5 text-[12px] font-medium text-fg-soft">
              Link {linkStatus}
            </span>
          )}

          {/* Filtro por formato */}
          <div className="relative shrink-0">
            <RoundBtn
              label="Filtrar por formato"
              onClick={() => setShowFormats((v) => !v)}
              active={showFormats || formatFilter.length > 0}
            >
              <SlidersIcon size={18} />
            </RoundBtn>
            {showFormats && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowFormats(false)}
                />
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[200px] animate-pop-in rounded-[16px] border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
                  {PIECE_FORMATS.map((f) => {
                    const on = formatFilter.includes(f.label);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setFormatFilter((list) =>
                            on
                              ? list.filter((l) => l !== f.label)
                              : [...list, f.label],
                          )
                        }
                        className="flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 text-left text-[13px] text-fg-soft hover:bg-border"
                      >
                        <span>{f.label}</span>
                        {on && <CheckIcon size={14} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Busca — abre por cima, o botão não sai do lugar */}
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
                placeholder="Buscar peça…"
                className="absolute right-0 top-1/2 h-10 w-[240px] -translate-y-1/2 animate-fade-in rounded-pill border border-border bg-surface pl-4 pr-12 text-[13px] text-fg-soft placeholder:text-muted focus:border-border-strong focus:outline-none"
              />
            )}
            <RoundBtn
              label="Buscar peça"
              onClick={() => setShowSearch((v) => !v)}
              active={showSearch || !!search}
            >
              <SearchIcon size={18} />
            </RoundBtn>
          </div>

          <ActionMenu
            triggerClassName="h-10 w-10 bg-surface text-fg-soft hover:bg-surface-2"
            menuClassName="w-[208px]"
            items={[
              {
                label: "Enviar por WhatsApp",
                icon: <MessageCircleIcon size={15} />,
                onSelect: () => share("whatsapp"),
              },
              {
                label: "Enviar por e-mail",
                icon: <InboxIcon size={15} />,
                onSelect: () => share("email"),
              },
              {
                label: "Copiar mensagem",
                icon: <SendIcon size={15} />,
                onSelect: copyMessage,
              },
              {
                label: "Abrir link público",
                icon: <ExternalLinkIcon size={15} />,
                divider: true,
                onSelect: () => window.open(`/a/${batch.token}`, "_blank"),
              },
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

          <button
            type="button"
            onClick={copyLink}
            disabled={linkStatus !== "ativo"}
            className="flex h-10 shrink-0 items-center gap-2 rounded-pill bg-primary px-5 text-[14px] font-semibold text-[#111111] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CopyIcon size={16} /> Copiar link
          </button>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={cn(
              "rounded-pill px-3.5 py-[7px] text-[12px] transition-colors",
              filter === c.id
                ? "bg-border font-semibold text-fg-soft"
                : "font-medium text-muted outline outline-1 -outline-offset-[0.5px] outline-border hover:text-fg-soft",
            )}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-0">
        {/* Grade de peças */}
        <div className="min-h-0 flex-1 overflow-y-auto pt-1 lg:pr-6">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">
              Nenhuma peça com esses filtros.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
              {filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  style={{ ["--d" as string]: i }}
                  className="stagger-item tap group flex flex-col gap-2.5 text-left"
                >
                  <PieceThumb
                    size={p.size}
                    media={p.media}
                    showBadge={false}
                    plain
                    className={cn(
                      "h-[190px] w-full transition-all duration-200 group-hover:-translate-y-0.5",
                      selectedId === p.id
                        ? "outline outline-1 -outline-offset-[0.5px] outline-fg-soft"
                        : "outline outline-1 -outline-offset-[0.5px] outline-transparent group-hover:outline-border-strong",
                    )}
                  />
                  <span className="text-[13px] font-semibold text-fg-soft">
                    {p.name}
                  </span>
                  <span className="text-[11px] text-muted">
                    {p.size} · {pieceFormatLabel(p)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel de detalhe */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-[18px] overflow-y-auto pt-1 lg:w-[300px] lg:border-l lg:border-border lg:pl-6">
          {selected ? (
            <DetailPanel
              piece={selected}
              busy={busy}
              onApprove={() => pieceAction(selected, "approve")}
              onRedo={() => pieceAction(selected, "redo")}
              onEditor={() =>
                router.push(`/social/${batch.id}/editor?peca=${selected.id}`)
              }
            />
          ) : (
            <p className="text-[13px] text-muted">
              Selecione uma peça para ver os detalhes.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function RoundBtn({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        // shrink-0 mantém o botão redondo mesmo quando a linha aperta.
        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
        active ? "bg-border-strong text-fg" : "bg-surface text-fg-soft hover:bg-surface-2",
      )}
    >
      {children}
    </button>
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
        <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 outline outline-1 -outline-offset-[0.5px] outline-border">
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
        <p className="rounded-panel border border-border bg-surface p-3 text-[12px] text-fg-2">
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
          ? "bg-primary text-[#111111] hover:bg-white"
          : "text-fg-soft outline outline-1 -outline-offset-[0.5px] outline-border hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}

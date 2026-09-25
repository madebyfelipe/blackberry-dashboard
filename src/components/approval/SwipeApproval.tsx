"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Batch, Piece, PieceStatus } from "@/lib/approval/types";
import { PieceThumb } from "./PieceThumb";
import { StatusBadge } from "./StatusBadge";
import { CheckIcon, XIcon } from "@/components/icons";

const THRESHOLD = 120;
const FLING_MS = 260;

export function SwipeApproval({ batch }: { batch: Batch }) {
  const [pieces, setPieces] = useState<Piece[]>(batch.pieces);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [fling, setFling] = useState<null | "left" | "right">(null);
  const [reason, setReason] = useState<{ open: boolean; text: string }>({
    open: false,
    text: "",
  });
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Trava síncrona: dois toques no mesmo frame chegam antes de `fling` virar
  // estado, e cada um mandaria sua decisão e somaria +1 ao índice.
  const busyRef = useRef(false);
  const router = useRouter();

  const current = pieces[index];
  const next = pieces[index + 1];
  const done = index >= pieces.length;

  const decided = pieces.filter((p) => p.status !== "pendente").length;

  function onPointerDown(e: React.PointerEvent) {
    if (reason.open || fling) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, active: true });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDrag({
      dx: e.clientX - startRef.current.x,
      dy: e.clientY - startRef.current.y,
      active: true,
    });
  }

  function onPointerUp() {
    if (!startRef.current) return;
    const { dx } = drag;
    startRef.current = null;
    if (dx > THRESHOLD) {
      void commit("aprovado");
    } else if (dx < -THRESHOLD) {
      // Reproval requires a reason.
      setDrag({ dx: 0, dy: 0, active: false });
      setReason({ open: true, text: "" });
    } else {
      setDrag({ dx: 0, dy: 0, active: false });
    }
  }

  async function commit(status: PieceStatus, reasonText?: string) {
    if (!current || busyRef.current) return;
    busyRef.current = true;
    const piece = current;
    const at = index;
    setError(null);
    setFling(status === "aprovado" ? "right" : "left");
    // Optimistic local update.
    setPieces((ps) =>
      ps.map((p) =>
        p.id === piece.id
          ? { ...p, status, reason: status === "ajuste" ? reasonText : p.reason }
          : p,
      ),
    );

    const animation = new Promise((r) => setTimeout(r, FLING_MS));
    let failure: { message: string; inactive: boolean } | null = null;
    try {
      const res = await fetch(`/api/approve/${batch.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pieceId: piece.id,
          decision: status,
          reason: reasonText,
          who: "Cliente",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        failure = {
          message: data?.error ?? "Não foi possível enviar sua decisão. Tente de novo.",
          inactive: res.status === 410,
        };
      }
    } catch {
      failure = {
        message: "Sem conexão. Sua decisão não foi enviada — tente de novo.",
        inactive: false,
      };
    }
    await animation;

    setDrag({ dx: 0, dy: 0, active: false });
    setFling(null);
    busyRef.current = false;
    if (failure) {
      // Desfaz o otimista: a peça volta como estava e o cliente fica nela.
      setPieces((ps) => ps.map((p) => (p.id === piece.id ? piece : p)));
      setError(failure.message);
      // Link expirado ou revogado no meio: o servidor já tem a tela certa.
      if (failure.inactive) router.refresh();
      return;
    }
    // Avança a partir da peça decidida, não do índice do momento.
    setIndex(at + 1);
  }

  function submitReason() {
    const text = reason.text.trim();
    if (!text) return;
    setReason({ open: false, text: "" });
    void commit("ajuste", text);
  }

  // Keyboard: → aprovar, ← pedir ajuste (desktop engagement).
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (reason.open || fling) return;
      if (e.key === "ArrowRight") void commit("aprovado");
      else if (e.key === "ArrowLeft") setReason({ open: true, text: "" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, reason.open, fling, index]);

  // Card transform
  const dx = fling === "right" ? 600 : fling === "left" ? -600 : drag.dx;
  const dy = fling ? -40 : drag.dy;
  const rot = dx / 22;
  const approveOpacity = Math.max(0, Math.min(1, dx / THRESHOLD));
  const rejectOpacity = Math.max(0, Math.min(1, -dx / THRESHOLD));

  return (
    <main className="flex min-h-screen flex-col items-center bg-bg px-4 py-6">
      <div className="flex w-full max-w-[440px] flex-1 flex-col">
        {/* Header */}
        <header className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-mark bg-dim text-[14px] font-bold text-fg">
            {batch.client.charAt(0)}
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-fg-soft">
              {batch.client}
            </div>
            <div className="text-[12px] text-muted">{batch.label}</div>
          </div>
          <div className="text-[13px] font-semibold text-fg-soft">
            {Math.min(decided, pieces.length)} / {pieces.length}
          </div>
        </header>

        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-pill bg-border">
          <div
            className="h-1.5 rounded-pill bg-primary transition-all duration-500"
            style={{ width: `${(decided / pieces.length) * 100}%` }}
          />
        </div>

        {done ? (
          <DoneScreen
            pieces={pieces}
            onReset={() => {
              setIndex(0);
            }}
          />
        ) : (
          <>
            {/* Card stack */}
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[380px] flex-1">
              {next && (
                <div className="absolute inset-0 scale-[0.96] opacity-60">
                  <PieceCard piece={next} />
                </div>
              )}
              {current && (
                // A `key` faz cada peça nascer num nó novo. Sem ela o React
                // reaproveitava o mesmo nó: ele ia de translate(±600px) para
                // translate(0) com a transição ligada, e o card da peça
                // seguinte entrava deslizando da borda de volta para o centro.
                <div
                  key={current.id}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
                  style={{
                    transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
                    transition: drag.active ? "none" : "transform .26s ease-out",
                  }}
                >
                  <PieceCard piece={current}>
                    {/* Overlays */}
                    <div
                      className="absolute left-4 top-4 rounded-pill bg-primary px-3 py-1.5 text-[13px] font-semibold text-on-primary"
                      style={{ opacity: approveOpacity }}
                    >
                      Aprovar
                    </div>
                    <div
                      className="absolute right-4 top-4 rounded-pill bg-surface px-3 py-1.5 text-[13px] font-semibold text-fg-soft inset-ring-1 inset-ring-border-strong"
                      style={{ opacity: rejectOpacity }}
                    >
                      Ajuste
                    </div>
                  </PieceCard>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="Pedir ajuste"
                onClick={() => setReason({ open: true, text: "" })}
                disabled={!!fling}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface text-fg-soft transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none"
              >
                <XIcon size={26} />
              </button>
              <button
                type="button"
                aria-label="Aprovar"
                onClick={() => void commit("aprovado")}
                disabled={!!fling}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none"
              >
                <CheckIcon size={26} />
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-center text-[13px] font-medium text-fg-soft">
                {error}
              </p>
            )}
            <p className="mt-4 text-center text-[12px] text-muted">
              Arraste para a direita para aprovar · esquerda para pedir ajuste
            </p>
          </>
        )}
      </div>

      {/* Reason modal */}
      {reason.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 animate-fade-in bg-black/60"
            onClick={() => setReason({ open: false, text: "" })}
          />
          <div className="relative w-full max-w-[440px] animate-pop-in rounded-t-card border border-border bg-surface p-6 sm:rounded-card">
            <h3 className="text-[16px] font-semibold text-fg">Pedir ajuste</h3>
            <p className="mt-1 text-[13px] text-muted">
              Conte o que precisa mudar nesta peça.
            </p>
            <textarea
              autoFocus
              value={reason.text}
              onChange={(e) => setReason((r) => ({ ...r, text: e.target.value }))}
              rows={4}
              placeholder="Ex.: trocar a cor do texto para melhorar a leitura."
              className="mt-4 w-full resize-none rounded-panel border border-border-strong bg-bg px-4 py-3 text-[14px] text-fg-soft placeholder:text-muted focus:border-fg-3 focus:outline-none"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setReason({ open: false, text: "" })}
                className="flex-1 rounded-field border border-border bg-surface px-4 py-3 text-[14px] font-medium text-fg-soft hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitReason}
                disabled={!reason.text.trim()}
                className="flex-1 rounded-field bg-primary px-4 py-3 text-[14px] font-medium text-on-primary disabled:opacity-50"
              >
                Enviar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PieceCard({
  piece,
  children,
}: {
  piece: Piece;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-2">
      <div className="relative flex-1">
        <PieceThumb
          size={piece.size}
          media={piece.media?.[0]}
          count={piece.media?.length}
          showBadge={false}
          className="h-full w-full rounded-none border-0"
        />
        {piece.status !== "pendente" && (
          <div className="absolute left-4 bottom-4">
            <StatusBadge status={piece.status} />
          </div>
        )}
        {children}
      </div>
      <div className="flex flex-col gap-1 p-5">
        <div className="text-[16px] font-semibold text-fg">{piece.name}</div>
        <div className="text-[13px] text-muted">{piece.kind}</div>
        {piece.caption && (
          <p className="mt-1 text-[13px] text-fg-2">{piece.caption}</p>
        )}
      </div>
    </div>
  );
}

function DoneScreen({
  pieces,
  onReset,
}: {
  pieces: Piece[];
  onReset: () => void;
}) {
  const aprovadas = pieces.filter((p) => p.status === "aprovado").length;
  const ajuste = pieces.filter((p) => p.status === "ajuste").length;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary">
        <CheckIcon size={30} />
      </div>
      <div className="space-y-1">
        <h2 className="text-[20px] font-semibold text-fg">Tudo revisado 🎉</h2>
        <p className="text-[14px] text-muted">
          {aprovadas} aprovadas · {ajuste} com ajuste pedido
        </p>
      </div>
      <p className="max-w-xs text-[13px] text-muted">
        Suas decisões foram enviadas para a agência. Você pode fechar esta página.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-field border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-fg-soft hover:bg-surface-2"
      >
        Revisar novamente
      </button>
    </div>
  );
}

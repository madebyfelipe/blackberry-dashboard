"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  MicIcon,
  PhoneOffIcon,
  ScreenShareIcon,
} from "@/components/icons";
import type { ConversationDetail, InboxMember } from "@/lib/inbox/types";
import { callClock, initialsOf } from "@/lib/inbox/view";

/*
 * A chamada, no popup que o Felipe pediu: os dois avatares frente a frente, o
 * cronômetro e os controles embaixo. Ela vive **dentro** da conversa — sai
 * daqui e o chat continua exatamente onde estava.
 *
 * O que esta tela faz de verdade hoje: abre a chamada, conta o tempo e, ao
 * encerrar, deixa o registro no histórico ("Fulano iniciou uma chamada que
 * durou 12 minutos" — a linha de sistema do export).
 *
 * O que ela ainda não faz: transmitir. Não existe camada de tempo real no
 * projeto (WebRTC/WebSocket) — a issue #30 registra que essa decisão técnica
 * vem depois do desenho. Então o microfone e a tela aparecem como o desenho
 * manda, **desligados e dizendo por quê**, em vez de acenderem fingindo que
 * alguém do outro lado está ouvindo. Quando a camada entrar, é aqui que os
 * dois botões ganham função — e mais nada nesta tela muda.
 */

export function CallOverlay({
  detail,
  me,
  withScreen,
  onEnd,
}: {
  detail: ConversationDetail;
  me: InboxMember;
  /** Chamada aberta pelo botão de tela compartilhada. */
  withScreen: boolean;
  /** Encerrar: a duração vai para o histórico da conversa. */
  onEnd: (seconds: number) => void;
}) {
  // O relógio começa a contar quando a chamada entra em tela, não no render.
  const startedAt = useRef(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    startedAt.current = started;
    const id = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const elapsed = () =>
    Math.floor((Date.now() - (startedAt.current || Date.now())) / 1000);
  const end = () => onEnd(elapsed());

  // Esc encerra, como fecha qualquer sobreposição do produto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onEnd(Math.floor((Date.now() - (startedAt.current || Date.now())) / 1000));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  const others = detail.members.filter((m) => m.id !== me.id);
  const other = detail.kind === "direta" ? others[0]?.name : detail.title;
  const extra = detail.kind === "grupo" ? Math.max(0, others.length - 1) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chamada em ${detail.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/75 backdrop-blur-[3px]" />

      <div className="relative flex w-full max-w-[380px] animate-scale-in flex-col items-center gap-5 rounded-card border border-border bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[15px] font-semibold text-fg">{detail.title}</p>
          <p
            className="text-[12px] tabular-nums text-muted"
            aria-live="off"
          >
            {callClock(seconds)}
            {withScreen && " · com tela"}
          </p>
        </div>

        {/* Os dois avatares: você e quem está do outro lado. */}
        <div className="flex items-center gap-3">
          <CallAvatar name={me.name} label="Você" />
          <span className="h-px w-6 bg-border" aria-hidden="true" />
          <CallAvatar name={other ?? detail.title} label={other ?? detail.title} />
          {extra > 0 && (
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-pill border border-dashed border-border text-[12px] font-medium text-muted">
              +{extra}
            </span>
          )}
        </div>

        <p className="max-w-[280px] text-center text-[11px] leading-[16px] text-muted">
          Áudio e tela entram com a camada de tempo real. Por enquanto a chamada
          marca o tempo e fica registrada na conversa.
        </p>

        <div className="flex items-center gap-3">
          <CallButton
            label="Microfone (chega com a camada de tempo real)"
            disabled
          >
            <MicIcon size={18} />
          </CallButton>
          <CallButton
            label="Compartilhar tela (chega com a camada de tempo real)"
            disabled
            active={withScreen}
          >
            <ScreenShareIcon size={18} />
          </CallButton>
          <button
            type="button"
            onClick={end}
            aria-label="Encerrar chamada"
            title="Encerrar chamada"
            autoFocus
            className="tap flex h-control w-control items-center justify-center rounded-pill bg-primary text-on-primary transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3"
          >
            <PhoneOffIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CallAvatar({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="flex h-[52px] w-[52px] items-center justify-center rounded-pill bg-border-strong text-[16px] font-semibold text-fg"
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <span className="max-w-[96px] truncate text-[11px] text-fg-3">{label}</span>
    </div>
  );
}

function CallButton({
  label,
  disabled,
  active,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "flex h-control w-control items-center justify-center rounded-pill transition-colors",
        active ? "bg-border text-fg-soft" : "bg-surface-2 text-fg-3",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      {children}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { Attachment } from "@/lib/inbox/types";
import {
  WAVEFORM_BARS,
  barHeight,
  formatClock,
  nextRate,
  rateLabel,
  resampleWaveform,
  type VoiceMeta,
} from "@/lib/inbox/voice";
import { measureRemoteAudio } from "./audioAnalysis";

/*
 * O player da mensagem de voz (export "Msg · Áudio"): botão redondo claro de
 * tocar/pausar, a forma de onda — o que já tocou em branco, o resto em cinza
 * —, o relógio "0:16 / 0:42" e o selo de velocidade (1× → 1,5× → 2×).
 *
 * A onda é também a barra de progresso: clicar ou arrastar nela leva o áudio
 * até ali, e pelo teclado ela é um slider (setas andam 5 s).
 *
 * As barras e a duração vêm no anexo (medidas por quem mandou, ver
 * `audioAnalysis.ts`). Mensagem antiga, sem elas, é medida aqui mesmo na
 * primeira vez que aparece; se nem assim der, as barras ficam baixas e
 * iguais, e o relógio usa o que o `<audio>` souber.
 *
 * Uma mensagem de voz toca de cada vez: dar play numa pausa a que estava
 * tocando.
 */

/** A que está tocando agora, em qualquer conversa aberta. */
let playingNow: HTMLAudioElement | null = null;

/** 3px de barra + 2px de vão, como no desenho. */
const BAR_STEP_PX = 5;
/** Largura da onda com as 56 barras do desenho. */
const WAVE_WIDTH_PX = WAVEFORM_BARS * BAR_STEP_PX - 2;
/**
 * O que o player ocupa fora da onda: bordas, respiros, botão, vãos e o
 * relógio no tamanho mais largo ("12:05 / 15:00"), com folga.
 */
const AROUND_WAVE_PX = 160;
/** Abaixo disso a onda não diz nada — melhor o player passar da coluna. */
const MIN_WAVE_PX = 60;
/** Quanto as setas andam no áudio. */
const KEY_STEP_SECONDS = 5;
/** Barra de quem ainda não tem forma de onda: baixa, igual, sem fingir fala. */
const FLAT_BAR = 12;

export function VoicePlayer({ attachment }: { attachment: Attachment }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [elementDuration, setElementDuration] = useState(0);
  const [measured, setMeasured] = useState<VoiceMeta>({});
  const [bars, setBars] = useState(WAVEFORM_BARS);

  const waveform = attachment.waveform ?? measured.waveform;
  const duration = attachment.duration ?? measured.duration ?? elementDuration;

  // Sem desenho no anexo: mede uma vez (e fica no cache do endereço).
  useEffect(() => {
    if (attachment.waveform && attachment.duration) return;
    let alive = true;
    void measureRemoteAudio(attachment.url, attachment.size).then((m) => {
      if (alive) setMeasured(m);
    });
    return () => {
      alive = false;
    };
  }, [attachment.url, attachment.size, attachment.waveform, attachment.duration]);

  // Quantas barras cabem: 56 no desktop, menos quando a coluna aperta.
  useLayoutEffect(() => {
    const el = waveRef.current;
    if (!el) return;
    const fit = () => {
      const n = Math.floor((el.clientWidth + 2) / BAR_STEP_PX);
      setBars(Math.max(8, Math.min(WAVEFORM_BARS, n)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // O relógio anda liso enquanto toca; o `timeupdate` sozinho pula de 250 em 250 ms.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setTime(el.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // Sai da tela tocando: para, para não ficar som sem player.
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      el?.pause();
      if (playingNow === el) playingNow = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = rate;
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [rate]);

  const seek = useCallback(
    (seconds: number) => {
      const el = audioRef.current;
      if (!el || !(duration > 0)) return;
      const t = Math.min(duration, Math.max(0, seconds));
      el.currentTime = t;
      setTime(t);
    },
    [duration],
  );

  const scrubbing = useRef(false);
  function seekAt(clientX: number) {
    const el = waveRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const drawn = bars * BAR_STEP_PX - 2;
    seek((Math.min(drawn, Math.max(0, clientX - r.left)) / drawn) * duration);
  }

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const shown = waveform?.length ? resampleWaveform(waveform, bars) : new Array<number>(bars).fill(FLAT_BAR);

  return (
    // A largura da onda sai da coluna (container query), não das barras — senão
    // uma decide a outra e a onda encolhe até sumir no celular.
    <div className="@container w-full">
      <div className="flex w-fit max-w-full items-center gap-3 rounded-tile border border-border bg-surface-2 py-[7px] pl-[7px] pr-[11px]">
        <audio
          ref={audioRef}
          src={attachment.url}
          preload="metadata"
          onPlay={(e) => {
            if (playingNow && playingNow !== e.currentTarget) playingNow.pause();
            playingNow = e.currentTarget;
            setPlaying(true);
          }}
          onPause={(e) => {
            if (playingNow === e.currentTarget) playingNow = null;
            setPlaying(false);
            setTime(e.currentTarget.currentTime);
          }}
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            setTime(0);
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setElementDuration(d);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setElementDuration(d);
          }}
          className="hidden"
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar mensagem de voz" : "Ouvir mensagem de voz"}
          className="tap flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
        >
          {playing ? <PauseIcon size={15} /> : <PlayIcon size={14} className="translate-x-[1px]" />}
        </button>

        <div
          ref={waveRef}
          role="slider"
          tabIndex={0}
          aria-label="Posição na mensagem de voz"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatClock(time)} de ${formatClock(duration)}`}
          aria-disabled={!(duration > 0)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX);
          }}
          onPointerMove={(e) => {
            if (scrubbing.current) seekAt(e.clientX);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
          }}
          onPointerCancel={() => {
            scrubbing.current = false;
          }}
          // Arrastar a onda é procurar no áudio — não o "arrastar para responder" da linha.
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const step: Record<string, number> = {
              ArrowRight: KEY_STEP_SECONDS,
              ArrowUp: KEY_STEP_SECONDS,
              ArrowLeft: -KEY_STEP_SECONDS,
              ArrowDown: -KEY_STEP_SECONDS,
            };
            if (e.key in step) seek(time + step[e.key]);
            else if (e.key === "Home") seek(0);
            else if (e.key === "End") seek(duration);
            else if (e.key === " " || e.key === "Enter") toggle();
            else return;
            e.preventDefault();
          }}
          className={cn(
            "flex h-[30px] shrink-0 items-center gap-[2px] overflow-hidden rounded-[2px] outline-none [touch-action:none]",
            "focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-4 focus-visible:ring-offset-surface-2",
            duration > 0 ? "cursor-pointer" : "cursor-default",
          )}
          style={{ width: `max(${MIN_WAVE_PX}px, min(${WAVE_WIDTH_PX}px, calc(100cqw - ${AROUND_WAVE_PX}px)))` }}
        >
          {shown.map((v, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "w-[3px] shrink-0 rounded-[2px]",
                (i + 0.5) / bars <= progress ? "bg-fg" : "bg-border-strong",
              )}
              style={{ height: barHeight(v) }}
            />
          ))}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[3px]">
          <span className="text-[11px] font-medium tabular-nums text-fg-soft">
            {formatClock(time)} / {duration > 0 ? formatClock(duration) : "–:––"}
          </span>
          <button
            type="button"
            onClick={() => {
              const r = nextRate(rate);
              setRate(r);
              if (audioRef.current) audioRef.current.playbackRate = r;
            }}
            aria-label={`Velocidade ${rateLabel(rate)} — trocar`}
            className="rounded-mark bg-border px-1.5 py-0.5 text-[10px] font-semibold leading-[12px] text-fg-3 transition-colors hover:text-fg-soft"
          >
            {rateLabel(rate)}
          </button>
        </div>
      </div>
    </div>
  );
}

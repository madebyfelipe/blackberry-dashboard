"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  AppWindowIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  MonitorIcon,
  RadioIcon,
  SignalIcon,
  VideoIcon,
  XIcon,
  ScreenShareIcon,
  RotateIcon,
  FlipHorizontalIcon,
} from "@/components/icons";
import {
  BITRATE_RANGE,
  DEFAULT_SCREEN_QUALITY,
  effectiveBitrate,
  RESOLUTION_OPTIONS,
  type ScreenFps,
  type ScreenQuality,
  type ScreenResolution,
  type ScreenSurface,
} from "@/lib/inbox/screenQuality";
import {
  CAMERA_RESOLUTIONS,
  STREAM_PRESETS,
  cameraCapture,
  supportsEffect,
  type CameraPrefs,
} from "@/lib/inbox/callPrefs";
import type { DeviceOption } from "@/lib/inbox/devices";

/*
 * Os modais de controle da chamada (export "Modais de controle da chamada"):
 * Compartilhar tela, Câmera e Qualidade da transmissão. Mostram e escolhem;
 * quem liga a tela, reabre a câmera e reajusta o codificador é a
 * `CallOverlay`, que tem a sala do LiveKit na mão.
 */

/* ================================================================== casca */

function Shell({
  title,
  icon,
  width,
  onClose,
  footer,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  width: "w-[480px]" | "w-[380px]";
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          width,
          "relative flex max-h-[calc(100dvh-32px)] max-w-full animate-scale-in flex-col overflow-hidden rounded-panel border border-panel-ring bg-surface-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-panel-ring px-[18px] py-4">
          <span className="flex items-center gap-2.5 text-fg">
            {icon}
            <h2 className="text-[15px] font-bold">{title}</h2>
          </span>
          <button
            type="button"
            aria-label="Fechar"
            title="Fechar"
            onClick={onClose}
            className="tap flex h-7 w-7 items-center justify-center rounded-chip bg-border text-fg-3 transition-colors hover:text-fg-soft"
          >
            <XIcon size={15} />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-[18px]">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-panel-ring px-[18px] py-3.5">
          {footer}
        </div>
      </div>
    </div>,
    // Em tela cheia só o elemento dela aparece: o modal tem de nascer dentro dele.
    document.fullscreenElement ?? document.body,
  );
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex items-center gap-2 rounded-chip bg-border px-4 py-[9px] text-[13px] font-semibold text-fg-soft transition-colors hover:bg-border-strong"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick,
  icon,
  disabled,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap flex items-center gap-2 rounded-chip bg-primary px-4 py-[9px] text-[13px] font-bold text-on-primary transition-colors hover:bg-white disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase text-muted">{children}</h3>;
}

function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-chip px-[13px] py-[7px] text-[12px] font-semibold transition-colors",
              on ? "bg-primary text-on-primary" : "border border-panel-ring bg-border text-fg-soft hover:bg-border-strong",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A chave de 40×24 dos modais. */
function SwitchRow({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-[13px] font-semibold", disabled ? "text-muted" : "text-fg")}>{label}</span>
        {hint && <span className="text-[12px] text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "flex h-6 w-10 shrink-0 items-center rounded-pill p-[3px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          on ? "justify-end bg-primary" : "justify-start bg-border",
        )}
      >
        <span className={cn("h-[18px] w-[18px] rounded-full", on ? "bg-on-primary" : "bg-fg-3")} />
      </button>
    </div>
  );
}

const SHARE_FPS: { id: ScreenFps; label: string }[] = [
  { id: 15, label: "15 fps" },
  { id: 30, label: "30 fps" },
  { id: 60, label: "60 fps" },
];

const RESOLUTION_CHIPS = RESOLUTION_OPTIONS.map((o) => ({ id: o.id, label: o.id === "original" ? "Fonte" : o.label }));

/* ======================================================= compartilhar tela */

const SURFACES: { id: ScreenSurface; tab: string; title: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: "monitor",
    tab: "Telas",
    title: "Tela inteira",
    hint: "Tudo o que está no monitor. Com mais de um, você escolhe qual no passo seguinte.",
    icon: <MonitorIcon size={26} />,
  },
  {
    id: "window",
    tab: "Janelas",
    title: "Uma janela",
    hint: "Só um programa — o navegador lista as janelas abertas no passo seguinte.",
    icon: <AppWindowIcon size={26} />,
  },
  {
    id: "browser",
    tab: "Aba",
    title: "Uma aba do navegador",
    hint: "Uma aba só, com o som dela — boa para vídeo e peça no navegador.",
    icon: <GlobeIcon size={26} />,
  },
];

/**
 * "Compartilhar tela". O navegador não deixa a página listar as janelas
 * abertas (é ele quem mostra o seletor, por segurança), então as abas do
 * modal escolhem o **tipo** — tela, janela ou aba — e o seletor do navegador
 * já abre nele. Resolução, quadros e som do sistema vão junto.
 */
export function ShareScreenModal({
  quality,
  onClose,
  onShare,
}: {
  quality: ScreenQuality;
  onClose: () => void;
  onShare: (q: ScreenQuality) => void;
}) {
  const [draft, setDraft] = useState(quality);
  const set = (p: Partial<ScreenQuality>) => setDraft((d) => ({ ...d, ...p }));
  const surface = SURFACES.find((s) => s.id === draft.surface) ?? SURFACES[0];

  return (
    <Shell
      title="Compartilhar tela"
      icon={<ScreenShareIcon size={18} />}
      width="w-[480px]"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => onShare(draft)} icon={<RadioIcon size={15} />}>
            Compartilhar
          </PrimaryButton>
        </>
      }
    >
      <div className="flex gap-0.5 rounded-chip bg-surface p-[3px]" role="tablist" aria-label="O que compartilhar">
        {SURFACES.map((s) => {
          const on = s.id === draft.surface;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => set({ surface: s.id })}
              className={cn(
                "flex-1 rounded-mark py-[7px] text-[12px] transition-colors",
                on ? "bg-border font-semibold text-fg" : "font-medium text-muted hover:text-fg-soft",
              )}
            >
              {s.tab}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-menu border-2 border-primary bg-primary/8 p-2">
        <span
          className="flex h-[88px] items-center justify-center rounded-mark text-muted"
          style={{ background: "linear-gradient(-110deg, var(--color-call-thumb-from), var(--color-call-thumb-to))" }}
        >
          {surface.icon}
        </span>
        <span className="px-0.5 text-[12px] font-semibold text-fg">{surface.title}</span>
        <span className="px-0.5 pb-0.5 text-[11.5px] leading-[16px] text-muted">{surface.hint}</span>
      </div>

      <Label>Resolução</Label>
      <Chips
        label="Resolução"
        options={RESOLUTION_CHIPS}
        value={draft.resolution}
        onChange={(v) => set({ resolution: v as ScreenResolution })}
      />
      <Label>Taxa de quadros</Label>
      <Chips label="Taxa de quadros" options={SHARE_FPS} value={draft.fps} onChange={(v) => set({ fps: v })} />
      <SwitchRow
        label="Compartilhar áudio do sistema"
        hint="Transmite o som do computador"
        on={draft.systemAudio}
        onChange={(v) => set({ systemAudio: v })}
      />
    </Shell>
  );
}

/* ================================================================= câmera */

/**
 * "Câmera": prévia ao vivo, aparelho, efeitos e resolução. A prévia abre a
 * câmera só enquanto o modal está aberto. Desfoque e iluminação são efeitos
 * que o próprio aparelho oferece ao navegador (Chrome/Edge com o recurso do
 * sistema) — sem eles, a chave fica desligada dizendo por quê, em vez de
 * fingir um efeito que não acontece.
 */
export function CameraModal({
  prefs,
  devices,
  initials,
  onClose,
  onApply,
}: {
  prefs: CameraPrefs;
  devices: DeviceOption[];
  initials: string;
  onClose: () => void;
  onApply: (p: CameraPrefs) => void;
}) {
  const [draft, setDraft] = useState(prefs);
  const set = (p: Partial<CameraPrefs>) => setDraft((d) => ({ ...d, ...p }));
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [caps, setCaps] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);
  const [list, setList] = useState(devices);
  const video = useRef<HTMLVideoElement>(null);

  // A prévia: reabre quando o aparelho ou a resolução mudam.
  useEffect(() => {
    let vivo = true;
    let aberto: MediaStream | null = null;
    const { deviceId, resolution } = cameraCapture(draft);
    navigator.mediaDevices
      ?.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: resolution.width },
          height: { ideal: resolution.height },
        },
      })
      .then(async (s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        aberto = s;
        setStream(s);
        setFailed(false);
        const track = s.getVideoTracks()[0];
        setCaps((track?.getCapabilities?.() as Record<string, unknown>) ?? {});
        // Com a permissão dada, os nomes das câmeras aparecem.
        const all = await navigator.mediaDevices.enumerateDevices();
        if (vivo) {
          setList(
            all
              .filter((d) => d.kind === "videoinput" && d.deviceId)
              .map((d, i) => ({ id: d.deviceId, label: d.label || `Câmera ${i + 1}` })),
          );
        }
      })
      .catch(() => vivo && setFailed(true));
    return () => {
      vivo = false;
      aberto?.getTracks().forEach((t) => t.stop());
    };
  }, [draft.deviceId, draft.resolution]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  // Efeitos na prévia, para ver antes de aplicar.
  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track || !caps) return;
    const c: Record<string, boolean> = {};
    if (supportsEffect(caps, "blur")) c.backgroundBlur = draft.blur;
    if (supportsEffect(caps, "lighting")) c.lightingCorrection = draft.lighting;
    if (Object.keys(c).length) void track.applyConstraints(c as MediaTrackConstraints).catch(() => undefined);
  }, [stream, caps, draft.blur, draft.lighting]);

  const blurOk = supportsEffect(caps, "blur");
  const lightOk = supportsEffect(caps, "lighting");
  const current = list.find((d) => d.id === draft.deviceId) ?? list[0];

  return (
    <Shell
      title="Câmera"
      icon={<VideoIcon size={18} />}
      width="w-[380px]"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => onApply(draft)} icon={<CheckIcon size={15} strokeWidth={2.5} />}>
            Aplicar
          </PrimaryButton>
        </>
      }
    >
      <div
        className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-menu"
        style={{ background: "linear-gradient(-107deg, var(--color-call-preview-from), var(--color-call-self-to))" }}
      >
        {stream ? (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className={cn("absolute inset-0 h-full w-full object-cover", draft.mirror && "-scale-x-100")}
          />
        ) : (
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-pill bg-white/15 text-[26px] font-bold text-fg">
            {initials}
          </span>
        )}
        {draft.mirror && (
          <span className="absolute left-3 top-3 flex items-center gap-[5px] rounded-mark bg-black/65 px-2 py-1 text-[11px] font-medium text-fg-soft">
            <FlipHorizontalIcon size={12} />
            Espelhado
          </span>
        )}
        {failed && (
          <span className="absolute inset-x-3 bottom-3 rounded-mark bg-black/65 px-2 py-1 text-center text-[11px] text-fg-soft">
            A câmera não abriu — libere no cadeado da barra de endereço.
          </span>
        )}
      </div>

      <Label>Dispositivo</Label>
      <label className="relative flex items-center gap-2.5 rounded-chip border border-panel-ring bg-surface px-3 py-2.5">
        <VideoIcon size={16} className="text-fg-3" />
        <select
          value={current?.id ?? ""}
          onChange={(e) => set({ deviceId: e.target.value || null })}
          aria-label="Câmera"
          className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-[13px] font-medium text-fg-soft focus:outline-none"
        >
          {list.length === 0 && <option value="">Nenhuma câmera encontrada</option>}
          {list.map((d) => (
            <option key={d.id} value={d.id} className="bg-surface">
              {d.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={16} className="pointer-events-none absolute right-3 text-muted" />
      </label>

      <SwitchRow
        label="Desfoque de fundo"
        hint={blurOk ? "Blur no ambiente atrás de você" : "Esta câmera/navegador não oferece desfoque"}
        on={blurOk && draft.blur}
        disabled={!blurOk}
        onChange={(v) => set({ blur: v })}
      />
      <SwitchRow label="Espelhar minha imagem" on={draft.mirror} onChange={(v) => set({ mirror: v })} />
      <SwitchRow
        label="Ajuste de iluminação"
        hint={lightOk ? undefined : "Esta câmera/navegador não oferece ajuste"}
        on={lightOk && draft.lighting}
        disabled={!lightOk}
        onChange={(v) => set({ lighting: v })}
      />

      <Label>Resolução</Label>
      <Chips label="Resolução da câmera" options={CAMERA_RESOLUTIONS} value={draft.resolution} onChange={(v) => set({ resolution: v })} />
    </Shell>
  );
}

/* ============================================ qualidade da transmissão */

/**
 * "Qualidade da transmissão": o padrão de toda tela que você compartilhar.
 * Salvar no meio de uma transmissão vale na hora. A aceleração por hardware
 * é decisão do navegador — a página não liga nem desliga —, então a chave
 * mostra isso em vez de prometer.
 */
export function StreamQualityModal({
  quality,
  onClose,
  onSave,
}: {
  quality: ScreenQuality;
  onClose: () => void;
  onSave: (q: ScreenQuality) => void;
}) {
  const [draft, setDraft] = useState(quality);
  const set = (p: Partial<ScreenQuality>) => setDraft((d) => ({ ...d, ...p }));
  const mbps = Math.round(effectiveBitrate(draft) / 1_000_000);

  return (
    <Shell
      title="Qualidade da transmissão"
      icon={<SignalIcon size={18} />}
      width="w-[380px]"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={() => setDraft({ ...DEFAULT_SCREEN_QUALITY, surface: draft.surface, systemAudio: draft.systemAudio })}>
            <RotateIcon size={14} />
            Restaurar
          </SecondaryButton>
          <PrimaryButton onClick={() => onSave(draft)} icon={<CheckIcon size={15} strokeWidth={2.5} />}>
            Salvar
          </PrimaryButton>
        </>
      }
    >
      <Label>Resolução do stream</Label>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Resolução do stream">
        {STREAM_PRESETS.map((p) => {
          const on = draft.resolution === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ resolution: p.id })}
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-chip border px-3 py-2.5 text-left transition-colors",
                on ? "border-primary bg-border" : "border-panel-ring bg-surface hover:bg-row-raised",
              )}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-fg">{p.label}</span>
                <span className="text-[11px] text-muted">{p.hint}</span>
              </span>
              <span
                className={cn(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                  on ? "border-fg" : "border-border-strong",
                )}
              >
                {on && <span className="h-2 w-2 rounded-full bg-fg" />}
              </span>
            </button>
          );
        })}
      </div>

      <Label>Taxa de quadros</Label>
      <div className="flex gap-0.5 rounded-chip bg-surface p-[3px]" role="radiogroup" aria-label="Taxa de quadros">
        {([30, 60] as const).map((f) => {
          const on = draft.fps === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ fps: f })}
              className={cn(
                "flex-1 rounded-mark py-2 text-[12px] transition-colors",
                on ? "bg-border font-semibold text-fg" : "font-medium text-muted hover:text-fg-soft",
              )}
            >
              {f} fps
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold uppercase text-muted">
          Bitrate — {mbps} Mbps{draft.bitrateMbps === null ? " (automático)" : ""}
        </span>
        <input
          type="range"
          min={BITRATE_RANGE.min}
          max={BITRATE_RANGE.max}
          step={1}
          value={mbps}
          onChange={(e) => set({ bitrateMbps: Number(e.target.value) })}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-pill bg-border accent-[var(--color-primary)]"
        />
      </label>

      <SwitchRow
        label="Aceleração por hardware"
        hint="O navegador decide sozinho quando usar a GPU"
        on
        disabled
        onChange={() => undefined}
      />
    </Shell>
  );
}

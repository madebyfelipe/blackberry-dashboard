"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIcon,
  AudioLinesIcon,
  FlipHorizontal2Icon,
  GaugeIcon,
  KeyboardIcon,
  MicIcon,
  MonitorUpIcon,
  PlayIcon,
  SparklesIcon,
  SpeakerIcon,
  VideoIcon,
  Volume2Icon,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import type { AudioPrefs } from "@/lib/inbox/audioPrefs";
import { CAMERA_RESOLUTIONS, type CameraPrefs } from "@/lib/inbox/callPrefs";
import { toDeviceOptions, type CallDevices } from "@/lib/inbox/devices";
import {
  FPS_OPTIONS,
  OPTIMIZE_OPTIONS,
  RESOLUTION_OPTIONS,
  type ScreenFps,
  type ScreenQuality,
} from "@/lib/inbox/screenQuality";
import { playAlertSound } from "./sounds";
import { Field, Pill, Row, Section, Segmented, SelectBox, SmallButton, Sub, Toggle } from "./kit";

/*
 * Configurações › Pessoal › Chamada e áudio. É o que a chamada usa ao
 * começar: microfone, saída de som e "Reduzir ruído" (`audioPrefs.ts`), a
 * câmera (`callPrefs.ts`) e a tela compartilhada (`screenQuality.ts`). Tudo
 * do aparelho, no navegador — e tudo também mudável durante a chamada.
 *
 * O microfone e a câmera só abrem quando a pessoa pede ("Testar", "Ver
 * prévia"): abrir sozinho ao entrar na tela pediria permissão sem motivo.
 */

export type CallDraft = { audio: AudioPrefs; camera: CameraPrefs; screen: ScreenQuality };

const EMPTY_DEVICES: CallDevices = { audioinput: [], audiooutput: [], videoinput: [] };
const DEFAULT_ID = "__padrao__";

/** 18 barras, como o desenho: as primeiras acendem em verde, as do meio mais escuras. */
const METER_BARS = 18;

/** O tamanho que a prévia pede à câmera — o mesmo que a chamada vai pedir. */
const PREVIEW_SIZE: Record<CameraPrefs["resolution"], { width: number; height: number }> = {
  "480p": { width: 640, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

function sinkSupported(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

export function CallSettings({
  draft,
  onChange,
}: {
  draft: CallDraft;
  onChange: (next: CallDraft) => void;
}) {
  const [devices, setDevices] = useState<CallDevices>(EMPTY_DEVICES);
  const [level, setLevel] = useState(0);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Só dá para saber depois de montar: no servidor não há navegador.
  const [canPickOutput, setCanPickOutput] = useState(true);
  useEffect(() => setCanPickOutput(sinkSupported()), []);
  const micStream = useRef<MediaStream | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const raf = useRef(0);

  const readDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioinput: toDeviceOptions(list.filter((d) => d.kind === "audioinput"), "audioinput"),
        audiooutput: toDeviceOptions(list.filter((d) => d.kind === "audiooutput"), "audiooutput"),
        videoinput: toDeviceOptions(list.filter((d) => d.kind === "videoinput"), "videoinput"),
      });
    } catch {
      // Sem acesso à lista: os campos ficam em "Padrão do sistema".
    }
  }, []);

  useEffect(() => {
    void readDevices();
    const md = navigator.mediaDevices;
    md?.addEventListener?.("devicechange", readDevices);
    return () => md?.removeEventListener?.("devicechange", readDevices);
  }, [readDevices]);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(raf.current);
    micStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    setMicOn(false);
    setLevel(0);
  }, []);

  const stopCamera = useCallback(() => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = null;
    setCameraOn(false);
  }, []);

  // Saiu da tela: fecha microfone e câmera — nada fica aceso sem ninguém ver.
  useEffect(() => () => {
    stopMic();
    stopCamera();
  }, [stopMic, stopCamera]);

  async function startMic(deviceId = draft.audio.inputId) {
    stopMic();
    setProblem(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          noiseSuppression: draft.audio.noiseSuppression,
        },
      });
      micStream.current = stream;
      setMicOn(true);
      void readDevices(); // a permissão libera o nome dos aparelhos
      const ac = new AudioContext();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      ac.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(Math.min(1, peak / 90));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      stream.getTracks()[0]?.addEventListener("ended", () => {
        void ac.close();
        stopMic();
      });
    } catch {
      setProblem("O navegador não liberou o microfone. Libere no cadeado da barra de endereço.");
    }
  }

  async function startCamera(camera = draft.camera) {
    stopCamera();
    setProblem(null);
    try {
      const size = PREVIEW_SIZE[camera.resolution];
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(camera.deviceId ? { deviceId: { exact: camera.deviceId } } : {}),
          width: { ideal: size.width },
          height: { ideal: size.height },
        },
      });
      camStream.current = stream;
      setCameraOn(true);
      void readDevices();
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setProblem("O navegador não liberou a câmera. Libere no cadeado da barra de endereço.");
    }
  }

  // A prévia acompanha o aparelho e a resolução escolhidos.
  useEffect(() => {
    if (videoRef.current && camStream.current) videoRef.current.srcObject = camStream.current;
  }, [cameraOn]);

  async function testOutput() {
    try {
      const el = new Audio("/sounds/notificacao.wav");
      const sink = draft.audio.outputId;
      if (sink && sinkSupported()) await (el as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(sink);
      await el.play();
    } catch {
      playAlertSound("blackberry");
    }
  }

  const setAudio = (patch: Partial<AudioPrefs>) => onChange({ ...draft, audio: { ...draft.audio, ...patch } });
  const setCamera = (patch: Partial<CameraPrefs>) => {
    const camera = { ...draft.camera, ...patch };
    onChange({ ...draft, camera });
    if (cameraOn && (patch.deviceId !== undefined || patch.resolution !== undefined)) void startCamera(camera);
  };
  const setScreen = (patch: Partial<ScreenQuality>) => onChange({ ...draft, screen: { ...draft.screen, ...patch } });

  const withDefault = (list: { id: string; label: string }[]) => [
    { id: DEFAULT_ID, label: "Padrão do sistema" },
    ...list.filter((d) => d.id !== "default"),
  ];
  const lit = Math.round(level * METER_BARS);

  return (
    <Section
      id="chamada"
      title="Chamada e áudio"
      note="Ajuste antes de entrar. Tudo isso também pode ser mudado durante a chamada."
      aside={micOn ? <Pill>Prévia do microfone ativa</Pill> : undefined}
    >
      <Sub label="Áudio" />
      <Row
        icon={<MicIcon size={15} />}
        label="Microfone"
        extra={
          <div className="flex items-center gap-[3px] pt-1">
            <span className="pr-1 text-[11px] text-set-hint">Nível</span>
            {Array.from({ length: METER_BARS }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  "h-2.5 w-1 rounded-[2px] transition-colors",
                  i < lit ? (i < METER_BARS * 0.4 ? "bg-ok" : "bg-ok-dim") : "bg-rule",
                )}
              />
            ))}
            <button
              type="button"
              onClick={() => (micOn ? stopMic() : void startMic())}
              className="pl-2 text-[11px] text-fg-3 underline-offset-2 hover:underline"
            >
              {micOn ? "Parar" : "Testar"}
            </button>
          </div>
        }
      >
        <SelectBox
          className="w-full md:w-[300px]"
          label="Microfone"
          value={draft.audio.inputId ?? DEFAULT_ID}
          options={withDefault(devices.audioinput)}
          onChange={(id) => {
            const inputId = id === DEFAULT_ID ? null : id;
            setAudio({ inputId });
            if (micOn) void startMic(inputId);
          }}
        />
      </Row>
      <Row
        icon={<SpeakerIcon size={15} />}
        label="Saída de som"
        help={canPickOutput ? undefined : "Este navegador toca sempre na saída padrão do sistema."}
      >
        <SelectBox
          className="w-full md:w-[300px]"
          label="Saída de som"
          disabled={!canPickOutput}
          value={draft.audio.outputId ?? DEFAULT_ID}
          options={withDefault(devices.audiooutput)}
          onChange={(id) => setAudio({ outputId: id === DEFAULT_ID ? null : id })}
        />
        <SmallButton icon={<PlayIcon size={14} />} onClick={() => void testOutput()}>
          Testar
        </SmallButton>
      </Row>
      <Row icon={<AudioLinesIcon size={15} />} label="Reduzir ruído" help="Filtra teclado, ventilador e barulho de fundo.">
        <Toggle
          label="Reduzir ruído"
          on={draft.audio.noiseSuppression}
          onChange={(noiseSuppression) => setAudio({ noiseSuppression })}
        />
      </Row>

      <Sub label="Câmera" />
      <div className="flex flex-col gap-5 border-b border-set-line p-5 md:flex-row">
        <div className="relative aspect-[300/188] w-full shrink-0 overflow-hidden rounded-[14px] border border-border bg-surface md:w-[300px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn("h-full w-full object-cover", !cameraOn && "hidden", draft.camera.mirror && "-scale-x-100")}
          />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <VideoIcon size={22} className="text-set-hint" />
              <SmallButton onClick={() => void startCamera()}>Ver prévia</SmallButton>
            </div>
          )}
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {draft.camera.mirror && (
              <span className="flex items-center gap-[5px] rounded-mark bg-black/65 px-2 py-1 text-[11px] font-medium text-fg-soft">
                <FlipHorizontal2Icon size={12} /> Espelhado
              </span>
            )}
            <span className="rounded-mark bg-black/65 px-2 py-1 text-[11px] font-semibold text-fg-soft">
              {draft.camera.resolution}
            </span>
          </div>
          {cameraOn && (
            <button
              type="button"
              onClick={stopCamera}
              className="absolute bottom-2.5 right-2.5 rounded-mark bg-black/65 px-2 py-1 text-[11px] font-medium text-fg-soft hover:bg-black/80"
            >
              Desligar prévia
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <Field label="Aparelho">
            <SelectBox
              icon={<VideoIcon size={14} />}
              label="Câmera"
              value={draft.camera.deviceId ?? DEFAULT_ID}
              options={withDefault(devices.videoinput)}
              onChange={(id) => setCamera({ deviceId: id === DEFAULT_ID ? null : id })}
            />
          </Field>
          <div className="flex flex-col rounded-[10px] border border-rule bg-surface">
            {(
              [
                ["mirror", "Espelhar minha imagem"],
                ["blur", "Desfoque de fundo"],
                ["lighting", "Ajuste de iluminação"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-badge-neutral px-3 py-2.5 last:border-b-0"
              >
                <span className="text-[12.5px] text-fg-soft">{label}</span>
                <Toggle label={label} on={draft.camera[key]} onChange={(on) => setCamera({ [key]: on })} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-fg-3">Resolução</span>
            <Segmented
              label="Resolução da câmera"
              options={CAMERA_RESOLUTIONS}
              value={draft.camera.resolution}
              onChange={(resolution) => setCamera({ resolution })}
            />
          </div>
          {problem && <p className="text-[12px] text-bad-fg">{problem}</p>}
        </div>
      </div>

      <Sub label="Tela compartilhada" />
      <Row icon={<MonitorUpIcon size={15} />} label="Resolução">
        <Segmented
          label="Resolução da tela compartilhada"
          options={RESOLUTION_OPTIONS}
          value={draft.screen.resolution}
          onChange={(resolution) => setScreen({ resolution })}
        />
      </Row>
      <Row
        icon={<GaugeIcon size={15} />}
        label="Quadros por segundo"
        help="Mais quadros deixam o movimento suave e pesam mais na conexão."
      >
        <Segmented
          label="Quadros por segundo"
          options={FPS_OPTIONS.map((o) => ({ id: o.id, label: o.id }))}
          value={`${draft.screen.fps}` as `${ScreenFps}`}
          onChange={(fps) => setScreen({ fps: Number(fps) as ScreenFps })}
        />
      </Row>
      <Row
        icon={<SparklesIcon size={15} />}
        label="Otimizar para"
        help="Nitidez para textos e layouts; fluidez para vídeos e animações."
      >
        <Segmented
          label="Otimizar para"
          options={OPTIMIZE_OPTIONS}
          value={draft.screen.optimize}
          onChange={(optimize) => setScreen({ optimize })}
        />
      </Row>
      <Row icon={<ActivityIcon size={15} />} label="Taxa de bits">
        <SelectBox
          className="w-full md:w-[220px]"
          label="Taxa de bits"
          value={draft.screen.bitrateMbps === null ? "auto" : String(draft.screen.bitrateMbps)}
          options={[
            { id: "auto", label: "Automática" },
            ...[2, 4, 6, 8, 12].map((m) => ({ id: String(m), label: `${m} Mbps` })),
          ]}
          onChange={(v) => setScreen({ bitrateMbps: v === "auto" ? null : Number(v) })}
        />
      </Row>
      <Row
        icon={<Volume2Icon size={15} />}
        label="Compartilhar o som do sistema"
        help="Quem assiste ouve o áudio do vídeo ou apresentação."
      >
        <Toggle
          label="Compartilhar o som do sistema"
          on={draft.screen.systemAudio}
          onChange={(systemAudio) => setScreen({ systemAudio })}
        />
      </Row>

      <Sub label="Atalho" />
      <Row
        icon={<KeyboardIcon size={15} />}
        label="Mudo no app de desktop"
        help="Liga e desliga o microfone durante a chamada. No Mac, use Cmd no lugar de Ctrl."
      >
        <span className="flex items-center gap-2">
          {["Ctrl", "Shift", "M"].map((k, i) => (
            <span key={k} className="flex items-center gap-2">
              {i > 0 && <span className="text-[13px] text-faint">+</span>}
              <kbd className="rounded-mark border border-border bg-surface-2 px-[9px] py-1 font-sans text-[12px] font-semibold text-fg-soft">
                {k}
              </kbd>
            </span>
          ))}
          <Pill tone="neutral" dot={false}>
            Fixo
          </Pill>
        </span>
      </Row>
    </Section>
  );
}

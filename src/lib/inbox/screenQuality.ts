/*
 * A qualidade da tela compartilhada: resolução, quadros por segundo e para
 * que ela é otimizada (texto nítido ou movimento fluido).
 *
 * Mora fora da `CallOverlay` porque é regra pura — o que cada escolha vira em
 * captura e em codificação — e porque a escolha fica guardada entre uma
 * chamada e outra (é preferência de quem transmite, não da chamada).
 */

export type ScreenResolution = "720p" | "1080p" | "1440p" | "original";
export type ScreenFps = 15 | 30 | 60;
/** `nitidez`: planilha, código, peça em revisão. `fluidez`: vídeo, animação. */
export type ScreenOptimize = "nitidez" | "fluidez";

/** O que o navegador oferece primeiro no seletor (abas Telas · Janelas · Aba do modal). */
export type ScreenSurface = "monitor" | "window" | "browser";

export type ScreenQuality = {
  resolution: ScreenResolution;
  fps: ScreenFps;
  optimize: ScreenOptimize;
  /** "Bitrate" do modal Qualidade da transmissão, em Mbps; `null` = automático pela resolução. */
  bitrateMbps: number | null;
  surface: ScreenSurface;
  /** "Compartilhar áudio do sistema". */
  systemAudio: boolean;
};

export const DEFAULT_SCREEN_QUALITY: ScreenQuality = {
  resolution: "1080p",
  fps: 30,
  optimize: "nitidez",
  bitrateMbps: null,
  surface: "monitor",
  systemAudio: true,
};

/** A régua do "Bitrate" — o mesmo piso e teto da banda automática. */
export const BITRATE_RANGE = { min: 1, max: 12 } as const;

export const RESOLUTION_OPTIONS: { id: ScreenResolution; label: string }[] = [
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
  { id: "1440p", label: "1440p" },
  { id: "original", label: "Original" },
];

export const FPS_OPTIONS: { id: `${ScreenFps}`; label: string }[] = [
  { id: "15", label: "15 fps" },
  { id: "30", label: "30 fps" },
  { id: "60", label: "60 fps" },
];

export const OPTIMIZE_OPTIONS: { id: ScreenOptimize; label: string }[] = [
  { id: "nitidez", label: "Nitidez" },
  { id: "fluidez", label: "Fluidez" },
];

const DIMENSIONS: Record<ScreenResolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  // "Original" ainda tem teto: um monitor 5K a 60 fps não passa em rede nenhuma.
  original: { width: 3840, height: 2160 },
};

/** Teto de banda da transmissão, para não afogar a conexão de quem mostra. */
const MAX_BITRATE = 12_000_000;
const MIN_BITRATE = 1_000_000;

/**
 * Banda para a escolha: proporcional a pixels × quadros, com mais bits por
 * pixel na nitidez (texto borrado é o pior defeito de uma tela compartilhada).
 */
export function screenBitrate(q: ScreenQuality): number {
  const { width, height } = DIMENSIONS[q.resolution];
  const bitsPerPixel = q.optimize === "nitidez" ? 0.1 : 0.07;
  const raw = width * height * q.fps * bitsPerPixel;
  return Math.round(Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, raw)));
}

/** A banda que vale: a escolhida no modal (dentro da régua) ou a automática. */
export function effectiveBitrate(q: ScreenQuality): number {
  if (q.bitrateMbps === null) return screenBitrate(q);
  const mbps = Math.min(BITRATE_RANGE.max, Math.max(BITRATE_RANGE.min, q.bitrateMbps));
  return Math.round(mbps * 1_000_000);
}

/** O que a escolha vira para o LiveKit: captura, dica de conteúdo e codificação. */
export function screenShareOptions(q: ScreenQuality) {
  const { width, height } = DIMENSIONS[q.resolution];
  return {
    capture: {
      audio: q.systemAudio,
      // O som do sistema entra na lista do navegador só quando pedido.
      systemAudio: q.systemAudio ? ("include" as const) : ("exclude" as const),
      // A aba escolhida no modal é o que o seletor do navegador abre primeiro.
      video: { displaySurface: q.surface },
      resolution: { width, height, frameRate: q.fps },
      contentHint: q.optimize === "nitidez" ? ("detail" as const) : ("motion" as const),
      // O som da tela não volta pelos seus próprios alto-falantes.
      suppressLocalAudioPlayback: true,
      selfBrowserSurface: "exclude" as const,
      surfaceSwitching: "include" as const,
    },
    publish: {
      screenShareEncoding: { maxBitrate: effectiveBitrate(q), maxFramerate: q.fps },
      // Na nitidez, perder quadros é melhor que perder resolução; na fluidez, o contrário.
      degradationPreference:
        q.optimize === "nitidez" ? ("maintain-resolution" as const) : ("maintain-framerate" as const),
    },
    /** Para trocar a qualidade no meio da transmissão, sem abrir o seletor de novo. */
    constraints: {
      width: { max: width },
      height: { max: height },
      frameRate: { max: q.fps },
    },
  };
}

const STORAGE_KEY = "bb:qualidade-tela";

/** Lê a escolha guardada; qualquer coisa estranha volta para o padrão. */
export function parseScreenQuality(raw: unknown): ScreenQuality {
  if (!raw || typeof raw !== "object") return DEFAULT_SCREEN_QUALITY;
  const r = raw as Record<string, unknown>;
  const resolution = RESOLUTION_OPTIONS.some((o) => o.id === r.resolution)
    ? (r.resolution as ScreenResolution)
    : DEFAULT_SCREEN_QUALITY.resolution;
  const fps = r.fps === 15 || r.fps === 30 || r.fps === 60 ? r.fps : DEFAULT_SCREEN_QUALITY.fps;
  const optimize =
    r.optimize === "nitidez" || r.optimize === "fluidez" ? r.optimize : DEFAULT_SCREEN_QUALITY.optimize;
  const bitrateMbps =
    typeof r.bitrateMbps === "number" && r.bitrateMbps >= BITRATE_RANGE.min && r.bitrateMbps <= BITRATE_RANGE.max
      ? r.bitrateMbps
      : null;
  const surface =
    r.surface === "monitor" || r.surface === "window" || r.surface === "browser"
      ? r.surface
      : DEFAULT_SCREEN_QUALITY.surface;
  const systemAudio = typeof r.systemAudio === "boolean" ? r.systemAudio : DEFAULT_SCREEN_QUALITY.systemAudio;
  return { resolution, fps, optimize, bitrateMbps, surface, systemAudio };
}

export function loadScreenQuality(): ScreenQuality {
  try {
    return parseScreenQuality(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_SCREEN_QUALITY;
  }
}

export function saveScreenQuality(q: ScreenQuality) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch {
    // Sem armazenamento (janela anônima): vale só para esta chamada.
  }
}

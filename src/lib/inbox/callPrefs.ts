/*
 * As preferências da chamada que não são da tela compartilhada (essas moram
 * em `screenQuality.ts`): a câmera do modal "Câmera" e as reações do botão
 * "Reagir". Regra pura, testada em `tests/inbox-call-prefs.test.ts`; quem
 * mexe na sala do LiveKit é a `CallOverlay`.
 */

export type CameraResolution = "480p" | "720p" | "1080p";

export type CameraPrefs = {
  /** `null` = a câmera padrão do sistema. */
  deviceId: string | null;
  /** "Espelhar minha imagem" — só para você; quem está do outro lado vê normal. */
  mirror: boolean;
  /** "Desfoque de fundo" — pedido ao navegador; vale onde o aparelho oferece. */
  blur: boolean;
  /** "Ajuste de iluminação" — idem. */
  lighting: boolean;
  resolution: CameraResolution;
};

export const DEFAULT_CAMERA_PREFS: CameraPrefs = {
  deviceId: null,
  mirror: true,
  blur: false,
  lighting: false,
  resolution: "720p",
};

export const CAMERA_RESOLUTIONS: { id: CameraResolution; label: string }[] = [
  { id: "480p", label: "480p" },
  { id: "720p", label: "720p" },
  { id: "1080p", label: "1080p" },
];

const CAMERA_DIMENSIONS: Record<CameraResolution, { width: number; height: number }> = {
  "480p": { width: 640, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

/** O que a escolha vira para abrir a câmera (LiveKit e `getUserMedia`). */
export function cameraCapture(p: CameraPrefs) {
  const { width, height } = CAMERA_DIMENSIONS[p.resolution];
  return {
    deviceId: p.deviceId ?? undefined,
    resolution: { width, height, frameRate: 30 },
  };
}

/**
 * Os efeitos pedidos ao navegador como restrição da faixa. Só entra o que o
 * aparelho anuncia em `getCapabilities()` — pedir o que ele não tem derruba a
 * faixa em alguns navegadores.
 */
export function cameraEffects(p: CameraPrefs, capabilities: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if ("backgroundBlur" in capabilities) out.backgroundBlur = p.blur;
  if ("lightingCorrection" in capabilities) out.lightingCorrection = p.lighting;
  return out;
}

/** O aparelho oferece o efeito? (a chave aparece em `getCapabilities()`). */
export function supportsEffect(capabilities: Record<string, unknown> | null, effect: "blur" | "lighting"): boolean {
  if (!capabilities) return false;
  const key = effect === "blur" ? "backgroundBlur" : "lightingCorrection";
  const v = capabilities[key];
  // Chrome anuncia `[false, true]` quando dá para ligar e `[false]` quando não.
  return Array.isArray(v) ? v.includes(true) : v === true;
}

export function parseCameraPrefs(raw: unknown): CameraPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_CAMERA_PREFS;
  const r = raw as Record<string, unknown>;
  return {
    deviceId: typeof r.deviceId === "string" && r.deviceId ? r.deviceId : null,
    mirror: typeof r.mirror === "boolean" ? r.mirror : DEFAULT_CAMERA_PREFS.mirror,
    blur: typeof r.blur === "boolean" ? r.blur : DEFAULT_CAMERA_PREFS.blur,
    lighting: typeof r.lighting === "boolean" ? r.lighting : DEFAULT_CAMERA_PREFS.lighting,
    resolution: CAMERA_RESOLUTIONS.some((o) => o.id === r.resolution)
      ? (r.resolution as CameraResolution)
      : DEFAULT_CAMERA_PREFS.resolution,
  };
}

const CAMERA_KEY = "bb:camera";

export function loadCameraPrefs(): CameraPrefs {
  try {
    return parseCameraPrefs(JSON.parse(localStorage.getItem(CAMERA_KEY) ?? "null"));
  } catch {
    return DEFAULT_CAMERA_PREFS;
  }
}

export function saveCameraPrefs(p: CameraPrefs) {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify(p));
  } catch {
    // Sem armazenamento (janela anônima): vale só para esta chamada.
  }
}

/* ================================================================ reações */

/** O que o "Reagir" oferece. Fora desta lista, a reação que chega é ignorada. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "🔥"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Quanto tempo a reação fica no quadro de quem reagiu. */
export const REACTION_MS = 3500;

/** A reação que vai pelo canal de dados da sala. */
export function encodeReaction(emoji: Reaction): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ tipo: "reacao", emoji }));
}

/** O que chegou pelo canal de dados — só reação conhecida passa. */
export function decodeReaction(bytes: Uint8Array): Reaction | null {
  try {
    const msg = JSON.parse(new TextDecoder().decode(bytes)) as { tipo?: unknown; emoji?: unknown };
    if (msg?.tipo !== "reacao") return null;
    return REACTIONS.includes(msg.emoji as Reaction) ? (msg.emoji as Reaction) : null;
  } catch {
    return null;
  }
}

/* ============================================================== qualidade */

/** As opções do "Resolução do stream" (modal Qualidade da transmissão), com a legenda de cada uma. */
export const STREAM_PRESETS = [
  { id: "720p", label: "720p", hint: "Padrão · menor consumo" },
  { id: "1080p", label: "1080p", hint: "Recomendado para telas" },
  { id: "1440p", label: "1440p", hint: "Requer boa conexão" },
  { id: "original", label: "Fonte", hint: "Resolução original (até 4K)" },
] as const;
